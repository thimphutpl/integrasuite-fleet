// Copyright (c) 2026, TTPL and contributors
// For license information, please see license.txt

frappe.ui.form.on('Trip Load Assessment', {
    refresh: function(frm) {
        calculate_and_render_dashboard(frm);
    },
    volume_capacity: function(frm) {
        calculate_and_render_dashboard(frm);
    },
    weight_capacity_tons: function(frm) {
        calculate_and_render_dashboard(frm);
    },
    stock_entry: function(frm) {
        if (!frm.doc.stock_entry) return;

        frappe.call({
            method: "integrasuite_fleet.fleet_management.doctype.trip_load_assessment.trip_load_assessment.get_stock_entry",
            args: { stock_entry: frm.doc.stock_entry },
            freeze: true,
            freeze_message: __("Fetching Stock Entry items…"),
            callback: function(r) {
                if (!r.message || !r.message.length) {
                    frappe.msgprint(__("No submitted items found in the selected Stock Entry."));
                    return;
                }

                // Clear existing rows so re-selecting rebuilds cleanly
                frm.clear_table("items");

                r.message.forEach(function(row) {
                    let child = frm.add_child("items");

                    // ---- Direct field mapping ----
                    child.item_code        = row.item_code;
                    child.item_name        = row.item_name;
                    child.description      = row.description;

                    // Quantities
                    child.qty              = row.qty;
                    child.uom              = row.uom;
                    child.conversion_factor = row.conversion_factor || 1;

                    // Weight (already KG in Stock Entry Detail)
                    // Prefer explicit total_weight, else derive
                    let total_wt_kg = flt(row.total_weight);
                    if (!total_wt_kg && row.weight_per_unit) {
                        total_wt_kg = flt(row.weight_per_unit) * flt(row.stock_qty || row.transfer_qty || row.qty);
                    }
                    child.total_weight_kg = total_wt_kg;
                    child.weight          = total_wt_kg; // if your field means per-unit weight, adjust here

                    // Dimensions (only if your child has these fields)
                    child.length = row.length;
                    child.width  = row.width;
                    child.height = row.height;

                    // Optional warehouse / accounting info
                    child.s_warehouse      = row.s_warehouse;
                    child.t_warehouse      = row.t_warehouse;
                    child.cost_center      = row.cost_center;
                    child.expense_account  = row.expense_account;

                    // Keep the link back to source for traceability (if field exists)
                    child.stock_entry_detail = row.name;
                });

                frm.refresh_field("items");
                calculate_and_render_dashboard(frm);
                frm.dirty(); // mark form as unsaved
            }
        });
    }
});

frappe.ui.form.on('Trip Load Assessment Item', {
    length: function(frm) { calculate_and_render_dashboard(frm); },
    width: function(frm) { calculate_and_render_dashboard(frm); },
    height: function(frm) { calculate_and_render_dashboard(frm); },
    qty: function(frm) { calculate_and_render_dashboard(frm); },
    total_weight_kg: function(frm) { calculate_and_render_dashboard(frm); },
    weight: function(frm) { calculate_and_render_dashboard(frm); },
    items_add: function(frm) { calculate_and_render_dashboard(frm); },
    items_remove: function(frm) { calculate_and_render_dashboard(frm); }
});

function calculate_and_render_dashboard(frm) {
    let total_vol = 0;
    let total_wt_kg = 0;

    // 1. Calculate totals from the child table (client-side for instant feedback)
    (frm.doc.items || []).forEach(item => {
        let length = flt(item.length);
        let width = flt(item.width);
        let height = flt(item.height);
        let qty = flt(item.qty);

        let row_vol = length * width * height * qty;
        total_vol += row_vol;
        
        // Accumulate weight in KG
        total_wt_kg += flt(item.total_weight_kg || item.weight);
    });

    // 2. Convert weight from KG to Tons
    let total_wt_tons = total_wt_kg / 1000.0;

    // 3. Safely get capacities
    let vol_cap = flt(frm.doc.volume_capacity);
    let wt_cap = flt(frm.doc.weight_capacity_tons);

    // 4. Calculate percentages safely (avoid division by zero)
    let vol_util = vol_cap > 0 ? (total_vol / vol_cap) * 100 : 0;
    let wt_util = wt_cap > 0 ? (total_wt_tons / wt_cap) * 100 : 0;

    // 5. Round values for display
    let vol_rounded = flt(vol_util, 2);
    let wt_rounded = flt(wt_util, 2);

    // 6. Determine colors
    let vol_color = vol_rounded <= 100 ? "#28a745" : "#dc3545";
    let wt_color = wt_rounded <= 100 ? "#007bff" : "#dc3545";

    // 7. Render HTML
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
    </div>
    `;

    // Note: We use set_df_property to inject the HTML into the custom field
    frm.set_df_property('utilization_dashboard', 'options', html);
    
    // If the dashboard is a Custom HTML field, we might need to refresh it explicitly
    if (frm.fields_dict.utilization_dashboard) {
        frm.fields_dict.utilization_dashboard.$wrapper.html(html);
    }
}