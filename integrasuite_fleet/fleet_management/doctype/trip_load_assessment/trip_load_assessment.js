// Copyright (c) 2026, TTPL and contributors
// For license information, please see license.txt

frappe.ui.form.on('Trip Load Assessment', {
    refresh: function (frm) {
        calculate_and_render_dashboard(frm);
    },
    volume_capacity: function (frm) {
        calculate_and_render_dashboard(frm);
    },
    weight_capacity_tons: function (frm) {
        calculate_and_render_dashboard(frm);
    },
    stock_entry: function (frm) {
        if (!frm.doc.stock_entry) return;

        frappe.call({
            method: "integrasuite_fleet.fleet_management.doctype.trip_load_assessment.trip_load_assessment.get_stock_entry",
            args: { stock_entry: frm.doc.stock_entry },
            freeze: true,
            freeze_message: __("Fetching Stock Entry items…"),
            callback: function (r) {
                if (!r.message || !r.message.length) {
                    frappe.msgprint(__("No submitted items found in the selected Stock Entry."));
                    return;
                }

                frm.clear_table("items");

                r.message.forEach(function (row) {
                    let child = frm.add_child("items");
                    child.item_code         = row.item_code;
                    child.item_name         = row.item_name;
                    child.description       = row.description;
                    child.qty               = row.qty;
                    child.uom               = row.uom;
                    child.conversion_factor = row.conversion_factor || 1;

                    let total_wt_kg = flt(row.total_weight);
                    if (!total_wt_kg && row.weight_per_unit) {
                        total_wt_kg = flt(row.weight_per_unit) * flt(row.transfer_qty || row.qty);
                    }
                    child.total_weight_kg = total_wt_kg;
                    child.weight          = total_wt_kg;

                    child.s_warehouse      = row.s_warehouse;
                    child.t_warehouse      = row.t_warehouse;
                    child.cost_center      = row.cost_center;
                    child.expense_account  = row.expense_account;
                    child.stock_entry_detail = row.name;
                });

                frm.refresh_field("items");

                // Now fill dimensions for each newly-added row
                (frm.doc.items || []).forEach(function (child) {
                    fetch_item_attrs(frm, child.doctype, child.name);
                });

                calculate_and_render_dashboard(frm);
                frm.dirty();
            }
        });
    }
});

frappe.ui.form.on('Trip Load Assessment Item', {
    item_code: function (frm, cdt, cdn) {
        fetch_item_attrs(frm, cdt, cdn);
    },
    qty: function (frm, cdt, cdn) {
        const row = locals["Trip Load Assessment Item"][cdn];
        if (row && row.weight) {
            frappe.model.set_value(cdt, cdn, "total_weight_kg",
                flt(row.weight) * flt(row.qty));
        }
        calculate_and_render_dashboard(frm);
    },
    uom: function (frm, cdt, cdn) {
        const row = locals["Trip Load Assessment Item"][cdn];
        if (!row || !row.item_code || !row.uom) return;
    
        // Re-read dimensions + weight from the row that matches the NEW uom
        fetch_item_attrs(frm, cdt, cdn);
    },

    length:          function (frm) { calculate_and_render_dashboard(frm); },
    width:           function (frm) { calculate_and_render_dashboard(frm); },
    height:          function (frm) { calculate_and_render_dashboard(frm); },
    total_weight_kg: function (frm) { calculate_and_render_dashboard(frm); },
    weight:          function (frm) { calculate_and_render_dashboard(frm); },
    items_add:       function (frm) { calculate_and_render_dashboard(frm); },
    items_remove:    function (frm) { calculate_and_render_dashboard(frm); }
});

function fetch_item_attrs(frm, cdt, cdn) {
    const row = locals["Trip Load Assessment Item"][cdn];
    if (!row || !row.item_code) return;

    frappe.db.get_doc("Item", row.item_code).then(item => {
        if (!item) return;

        // Ensure uom exists so we can match the right UOM Conversion Detail row.
        // IMPORTANT: do not overwrite a uom the user just picked.
        if (!row.uom) {
            frappe.model.set_value(cdt, cdn, "uom", item.stock_uom);
            row.uom = item.stock_uom;
        }
        if (!flt(row.qty)) {
            frappe.model.set_value(cdt, cdn, "qty", 1);
            row.qty = 1;
        }

        // Locate UOM Conversion Detail child rows dynamically
        const ucdKey = Object.keys(item).find(k =>
            k.toLowerCase().includes("uom") && Array.isArray(item[k])
        );
        const ucds = ucdKey ? item[ucdKey] : [];

        if (!ucds.length) {
            console.warn("[TripLoad] Item", item.name,
                "has no UOM Conversion Detail rows. Dimensions will be 0.");
            return;
        }

        // Prefer the row matching the row's uom; fall back explicitly
        let matched = ucds.find(d => d.uom === row.uom);
        let source  = "matched uom";

        if (!matched) {
            matched = ucds.find(d => d.uom === item.stock_uom);
            source  = "fell back to stock_uom";
        }
        if (!matched) {
            matched = ucds[0];
            source  = "fell back to first row";
        }

        console.log("[TripLoad] item:", item.name,
                    "| row.uom:", row.uom,
                    "| matched UCD uom:", matched.uom,
                    "| source:", source,
                    "| row:", matched);

        const L = flt(matched.custom_length);
        const W = flt(matched.custom_width);
        const H = flt(matched.custom_height);
        const perUnitWt = flt(
            matched.weight_per_unit != null ? matched.weight_per_unit : item.weight_per_unit
        );

        frappe.model.set_value(cdt, cdn, "length", L);
        frappe.model.set_value(cdt, cdn, "width",  W);
        frappe.model.set_value(cdt, cdn, "height", H);
        frappe.model.set_value(cdt, cdn, "weight", perUnitWt);
        frappe.model.set_value(cdt, cdn, "total_weight_kg", perUnitWt * flt(row.qty));

        calculate_and_render_dashboard(frm);
    }).catch(err => {
        console.error("[TripLoad] failed to fetch Item", row.item_code, err);
    });
}

function calculate_and_render_dashboard(frm) {
    let total_vol = 0;
    let total_wt_kg = 0;

    (frm.doc.items || []).forEach(item => {
        total_vol += flt(item.length) * flt(item.width) * flt(item.height) * flt(item.qty);
        total_wt_kg += flt(item.total_weight_kg || item.weight);
    });

    let total_wt_tons = total_wt_kg / 1000.0;
    let vol_cap = flt(frm.doc.volume_capacity);
    let wt_cap  = flt(frm.doc.weight_capacity_tons);

    let vol_util = vol_cap > 0 ? (total_vol / vol_cap) * 100 : 0;
    let wt_util  = wt_cap  > 0 ? (total_wt_tons / wt_cap) * 100 : 0;

    let vol_rounded = flt(vol_util, 2);
    let wt_rounded  = flt(wt_util, 2);
    let vol_color   = vol_rounded <= 100 ? "#28a745" : "#dc3545";
    let wt_color    = wt_rounded  <= 100 ? "#007bff" : "#dc3545";

    let html = `
    <div class="row" style="margin: 0 -10px;">
        <div class="col-sm-6" style="padding: 0 10px;">
            <div class="card p-3 mb-3" style="border: 1px solid #d1d8dd; border-radius: 8px; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                <div class="d-flex align-items-center mb-2">
                    <span class="mr-3" style="font-size: 28px; color: #2490ef;">📦</span>
                    <div>
                        <h6 class="text-muted m-0" style="font-size: 13px; font-weight: 600; text-transform: uppercase;">Volume Utilization</h6>
                        <h3 class="m-0" style="font-weight: 700; color: ${vol_color};">${vol_rounded}%</h3>
                    </div>
                </div>
                <div class="text-muted mb-2" style="font-size: 13px; font-weight: 500;">
                    ${flt(total_vol, 3)} m³ / ${flt(vol_cap, 3)} m³
                </div>
                <div class="progress" style="height: 8px; background-color: #ebf1f5; border-radius: 4px; overflow: hidden;">
                    <div class="progress-bar" role="progressbar" style="width: ${Math.min(vol_rounded, 100)}%; background-color: ${vol_color};"></div>
                </div>
            </div>
        </div>
        <div class="col-sm-6" style="padding: 0 10px;">
            <div class="card p-3 mb-3" style="border: 1px solid #d1d8dd; border-radius: 8px; background: #fff; box-shadow: 0 1px 3px rgba(0,0,0,0.05);">
                <div class="d-flex align-items-center mb-2">
                    <span class="mr-3" style="font-size: 28px; color: #2490ef;">⚖️</span>
                    <div>
                        <h6 class="text-muted m-0" style="font-size: 13px; font-weight: 600; text-transform: uppercase;">Weight Utilization</h6>
                        <h3 class="m-0" style="font-weight: 700; color: ${wt_color};">${wt_rounded}%</h3>
                    </div>
                </div>
                <div class="text-muted mb-2" style="font-size: 13px; font-weight: 500;">
                    ${flt(total_wt_tons, 3)} tons / ${flt(wt_cap, 3)} tons
                </div>
                <div class="progress" style="height: 8px; background-color: #ebf1f5; border-radius: 4px; overflow: hidden;">
                    <div class="progress-bar" role="progressbar" style="width: ${Math.min(wt_rounded, 100)}%; background-color: ${wt_color};"></div>
                </div>
            </div>
        </div>
    </div>`;

    frm.set_df_property('utilization_dashboard', 'options', html);
    if (frm.fields_dict.utilization_dashboard) {
        frm.fields_dict.utilization_dashboard.$wrapper.html(html);
    }
}