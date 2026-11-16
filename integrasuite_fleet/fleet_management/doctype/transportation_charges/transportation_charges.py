# Copyright (c) 2026, TTPL and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.utils import flt
from frappe import _
from frappe.model.mapper import get_mapped_doc
from frappe.utils import flt, cint, nowdate, time_diff_in_hours, nowtime

class TransportationCharges(Document):
	pass

	def validate(self):
		self.calculate_transportation_charges()
		self.calculate_net_charges()
		self.validate_location()

	def on_submit(self):
		self.calculate_transportation_charges()
		self.calculate_net_charges()

	def calculate_transportation_charges(self):
		hill_charges = 0
		plain_charges = 0
		total_net_charges = 0
		for item in self.transportation_charge:
			if item.elevation_type == "Hill":
				hill_charges = item.distance * item.rate * item.quantity
				item.amount = hill_charges	
			elif item.elevation_type == "Plain":	
				plain_charges = item.distance * item.rate * item.quantity
				item.amount = plain_charges	
			else:
				return
		total_net_charges =	plain_charges + hill_charges	
		self.net_transportation_charge = total_net_charges

	def calculate_net_charges(self):
		hill_charges = 0
		plain_charges = 0
		total_net_charges = 0
		actual_charges = 0
		for item in self.transportation_charge:
			if item.elevation_type == "Hill":
				hill_charges = item.distance * item.rate * item.quantity
				item.amount = hill_charges	
			elif item.elevation_type == "Plain":	
				plain_charges = item.distance * item.rate * item.quantity
				item.amount = plain_charges	
		total_net_charges =	(plain_charges + hill_charges)
		# actual_charges = total_net_charges - self.transit_loss_charge
		actual_charges = (
			total_net_charges - self.transit_loss_charge
			if self.transit_loss_charge > 0
			else total_net_charges
		)
		self.actual_transportation_charge = actual_charges

	def validate_location(self):
		if self.source_location == self.destination_location:
			frappe.throw(
				_("Source location {0} and destination location {1} cannot be same.").format(
					self.source_location, self.destination_location
				)
			)

@frappe.whitelist()
def get_operator(equipment):
    if equipment:
        return frappe.get_all(
            "Equipment Operator Item",
            filters={
                "docstatus": 1,
                "parent": equipment
            },
            fields=[
				"operator_name"
            ]
        )			

@frappe.whitelist()
def make_transportation_invoice(source_name, target_doc=None): 
	def update_date(obj, target, source_parent):
		target.posting_date = nowdate()
	def set_missing_values(source, target):
		for a in source.transportation_charge:
			# if (a.qty_in_warehouse <= 0 and a.qty_required > 0) or (a.qty_in_warehouse > 0 and a.qty_required > a.qty_in_warehouse and a.qty_required > 0):
			if a.quantity > 0:
				row = target.append("transporter_invoice_details",{})
				row.qty = flt(a.quantity)
				row.amount = flt(a.rate)
				row.deduction = source.transit_loss_charge
				row.transport_date = source.transport_charge_date
				row.vehicle_no = source.equipment	
				row.transport_charge_no = source.name
				row.payable_amount = source.actual_transportation_charge
				target.grand_total = source.actual_transportation_charge
	doc = get_mapped_doc("Transportation Charges", source_name, {
			"Transportation Charges": {
				"doctype": "Transportation Invoice",
				"field_map": {
					"name": "transporter_charges",
					"posting_date": "invoice_date",
					"actual_transportation_charge":"outstanding_amount",
					# "actual_transportation_charge": "grand_total",
					"destination_location": "location"
				},
				"postprocess": update_date,
				"validation": {"docstatus": ["=", 1]},

			},
			# "Transportation Charges Item": {
			# 	"doctype": "Transporter Invoice Details",
			# 	"field_map":{
			# 		"item_name":"item_name"
			# 	},
			# }
		}, target_doc, set_missing_values)
	return doc		