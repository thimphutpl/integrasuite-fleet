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
    if stock_entry:
        return frappe.get_all(
            "Stock Entry Detail",
            filters={
                "docstatus": 1,
                "parent": stock_entry
            },
            fields=[
				"s_warehouse",
				"t_warehouse",
				"item_code",
				"qty",
				"uom",
				"stock_uom",
				"conversion_factor",
				"item_name",
                "basic_rate",
                "basic_amount",
                "amount",
                "valuation_rate",
                "cost_center",
                "expense_account"
            ]
        )