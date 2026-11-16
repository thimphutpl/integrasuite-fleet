# Copyright (c) 2026, TTPL and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.utils import money_in_words


class TransportationInvoice(Document):

	def validate(self):
		self.total_qty()
		self.in_words = money_in_words(self.grand_total)


	def on_submit():
		self.post_journal_entry()

	def total_qty(self):
		for i in self.transporter_invoice_details:
			total_qty = 0
			total_amount = 0
			total_qty = i.qty
			total_amount = i.payable_amount
		self.total_quantity = total_qty
		self.total =  total_amount

	def post_journal_entry(self):
		return

		je = frappe.new_doc("Journal Entry")
		je.posting_date = self.invoice_date

		je.insert() 
