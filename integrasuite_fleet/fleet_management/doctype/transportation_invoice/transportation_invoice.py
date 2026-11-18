# Copyright (c) 2026, TTPL and contributors
# For license information, please see license.txt

import frappe
from frappe.model.document import Document
from frappe.utils import money_in_words


class TransportationInvoice(Document):

	def validate(self):
		self.total_qty()
		self.in_words = money_in_words(self.grand_total)


	def on_submit(self):
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
		if self.company:
			default_bank_account = frappe.db.get_value("Company", self.company, "default_bank_account")
		else:	
			default_bank_account = frappe.db.get_value("Branch", self.branch, "expense_bank_account")
		advance_account = frappe.db.get_single_value("Maintenance Accounts Settings", "default_advance_amount")

		if not default_bank_account:
			frappe.throw(
				"Default Expense Bank Account is not set for {}. Please configure it in the Branch.".format(
					frappe.get_desk_link("Branch", self.branch)
				),
				title="Missing Account"
			)

		if not advance_account:
			frappe.throw(
				"POL Advance Account is not set for {}. Please configure it in the Company.".format(
					frappe.get_desk_link("Company", self.company)
				),
				title="Missing Account"
			)

		# Posting Journal Entry
		accounts = []
		accounts.append({
			"account": advance_account,
			"debit": flt(self.grand_total),
			"debit_in_account_currency": flt(self.grand_total),
			"cost_center": self.cost_center,
			# "reference_type": self.doctype,
			# "reference_name": self.name,
		})

		if self.transit_loss_charge > 0:
			accounts.append({
				"account": default_bank_account,
				"debit": flt(self.transit_loss_charge),
				"debit_in_account_currency": flt(self.transit_loss_charge),
				"cost_center": self.cost_center,
			})	

		accounts.append({
			"account": default_bank_account,
			"credit": flt(self.net_amount),
			"credit_in_account_currency": flt(self.grand_total),
			"cost_center": self.cost_center,
		})

		je = frappe.new_doc("Journal Entry")
		voucher_type = "Bank Entry"
		naming_series = "Bank Payment Voucher"
		
		je.update({
				"doctype": "Journal Entry",
				"voucher_type": voucher_type,
				"naming_series": naming_series,
				"title": "Transportation Invoice - "+self.equipment,
				"user_remark": "Transportation Invoice - "+self.equipment,
				"posting_date": nowdate(),
				"company": self.company,
				# "accounts": accounts,
				"branch": self.location,
				# "reference_name": self.name,
				# "reference_type": "POL Advance"
				# "custom_pol_advance": self.name,
		})

		je.save(ignore_permissions = True)
		self.db_set("journal_entry", je.name)
		self.db_set("journal_entry_status", "Forwarded to accounts for processing payment on {0}".format(now_datetime().strftime('%Y-%m-%d %H:%M:%S')))
		frappe.msgprint(_('{} posted to accounts').format(frappe.get_desk_link(je.doctype,je.name)))
