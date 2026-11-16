// Copyright (c) 2026, TTPL and contributors
// For license information, please see license.txt

frappe.ui.form.on("Transportation Charges", {
	refresh(frm) {
        if(frm.doc.docstatus == 1) {
            if (frm.doc.actual_transportation_charge > 0) {
				frm.add_custom_button("Transportation Invoice", function () {
					frappe.model.open_mapped_doc({
						method: "integrasuite_fleet.fleet_management.doctype.transportation_charges.transportation_charges.make_transportation_invoice",
						frm: cur_frm
					})
				},__("Create"));
			}
        }

	},
    "equipment": function (frm) {
        if (frm.doc.equipment) {
            frappe.call({
                method: "integrasuite_fleet.fleet_management.doctype.transportation_charges.transportation_charges.get_operator",
                args: {equipment: frm.doc.equipment },
                callback: function (r) {
                    console.log(r.message)
                    if (r.message) {
                    }
                }
            });
        }
    }
});
