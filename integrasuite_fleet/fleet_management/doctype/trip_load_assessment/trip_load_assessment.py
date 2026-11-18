# # Copyright (c) 2026, TTPL and contributors
# # For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.utils import flt


class TripLoadAssessment(Document):

	def validate(self):
		self.calculate_total_volume()
		self.calculate_overall_volumn()


	def calculate_total_volume(self):
		for item in self.items:
			total_volume = 0
			total_volume = item.length * item.width * item.height * item.qty
			item.total_volume = total_volume

	# def calculate_overall_volumn(self):
	# 	overall_volumn = 0
	# 	overall_capacity = 0
	# 	for item in self.items:
	# 		overall_volumn = item.total_volume
	# 		overall_capacity = item.total_weight_kg
	# 	self.total_volume_capacity	= overall_volumn
	# 	self.total_weight_capacity = overall_capacity

	# 	self.volume_utilization	= (overall_volumn/self.volume_capacity * 100)
	# 	self.weight_utilization = (overall_capacity/self.weight_capacity_tons * 100)

	# In trip_load_assessment.py

	def calculate_overall_volumn(self):
		overall_volume = 0
		overall_weight_kg = 0
		
		for item in self.items:
			# Use flt() to handle empty/None values safely
			overall_volume += flt(item.total_volume)
			overall_weight_kg += flt(item.total_weight_kg or item.weight)
			
		self.total_volume_capacity = overall_volume
		self.total_weight_capacity = overall_weight_kg
		
		# 1. Convert weight to tons so it matches weight_capacity_tons
		overall_weight_tons = overall_weight_kg / 1000.0
		
		# 2. Safe division for Volume
		if flt(self.volume_capacity) > 0:
			self.volume_utilization = (overall_volume / flt(self.volume_capacity)) * 100
		else:
			self.volume_utilization = 0
			
		# 3. Safe division for Weight
		if flt(self.weight_capacity_tons) > 0:
			self.weight_utilization = (overall_weight_tons / flt(self.weight_capacity_tons)) * 100
		else:
			self.weight_utilization = 0

@frappe.whitelist()
def get_stock_entry(stock_entry):
    if not stock_entry:
        return []

    # Make sure the Stock Entry is submitted & not cancelled
    se = frappe.db.get_value(
        "Stock Entry", stock_entry, ["docstatus", "stock_entry_type"], as_dict=True
    )
    if not se:
        frappe.throw(f"Stock Entry {stock_entry} not found")
    if se.docstatus != 1:
        frappe.throw(f"Stock Entry {stock_entry} must be submitted (docstatus=1)")

    return frappe.get_all(
        "Stock Entry Detail",
        filters={"parent": stock_entry, "parenttype": "Stock Entry"},
        fields=[
            "name",
            "item_code",
            "item_name",
            "description",
            "qty",
            "transfer_qty",
            "uom",
            "stock_uom",
            "conversion_factor",
            "stock_qty",
            "basic_rate",
            "basic_amount",
            "amount",
            "valuation_rate",
            "s_warehouse",
            "t_warehouse",
            "cost_center",
            "expense_account",
            "project",
            "batch_no",
            "serial_no",
            "weight_per_unit",
            "total_weight",          # in KG (stock UOM based)
            "against_sales_order",
            "against_sales_invoice",
        ],
        order_by="idx asc",
    )		