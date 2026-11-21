-- =====================================================================
-- ROYAL POWER – Migration 0004: seed data (safe to re-run)
-- =====================================================================

-- ---------- departments ----------
insert into public.departments (name, sort_order)
values
  ('Information Technology', 1), ('Human Resources', 2), ('Finance', 3), ('Accounts', 4),
  ('Administration', 5), ('Operations', 6), ('Procurement', 7), ('Marketing', 8),
  ('Sales', 9), ('Warehouse', 10), ('Security', 11), ('Management', 12)
on conflict do nothing;

-- ---------- equipment categories ----------
insert into public.equipment_categories (name, description, icon, sort_order)
values
  ('Computer Accessories',          'Everyday peripherals such as keyboards, mice and headsets.', 'Keyboard', 1),
  ('Display & Video Equipment',     'Monitors, display cables, converters and stands.',           'Monitor',  2),
  ('Computer Hardware',             'Computers and internal components.',                         'Cpu',      3),
  ('Network Equipment',             'Cabling, switches, routers and wireless gear.',              'Network',  4),
  ('Power & Electrical Accessories','UPS units, adapters, power cords and protection.',           'Zap',      5),
  ('Printer & Office IT Equipment', 'Printers, scanners and printing consumables.',               'Printer',  6),
  ('Other IT Equipment',            'Phones, cameras, biometric devices and anything else.',      'Boxes',    7)
on conflict do nothing;

-- ---------- equipment items ----------
insert into public.equipment_items (category_id, name, sort_order, is_other)
select c.id, i.name, i.ord, (i.name = 'Other IT Equipment')
from (values
  ('Computer Accessories', 'Keyboard', 1), ('Computer Accessories', 'Mouse', 2),
  ('Computer Accessories', 'Mouse Pad', 3), ('Computer Accessories', 'USB Keyboard', 4),
  ('Computer Accessories', 'Wireless Mouse', 5), ('Computer Accessories', 'USB Hub', 6),
  ('Computer Accessories', 'Headphones', 7), ('Computer Accessories', 'Webcam', 8),

  ('Display & Video Equipment', 'LCD Monitor', 1), ('Display & Video Equipment', 'LED Monitor', 2),
  ('Display & Video Equipment', 'HDMI Cable', 3), ('Display & Video Equipment', 'VGA Cable', 4),
  ('Display & Video Equipment', 'DisplayPort Cable', 5), ('Display & Video Equipment', 'HDMI to VGA Converter', 6),
  ('Display & Video Equipment', 'Monitor Stand', 7),

  ('Computer Hardware', 'Desktop PC', 1), ('Computer Hardware', 'Mini PC', 2),
  ('Computer Hardware', 'Laptop', 3), ('Computer Hardware', 'RAM', 4),
  ('Computer Hardware', 'SSD', 5), ('Computer Hardware', 'HDD', 6),
  ('Computer Hardware', 'M.2 NVMe Storage', 7), ('Computer Hardware', 'CPU', 8),
  ('Computer Hardware', 'Motherboard', 9), ('Computer Hardware', 'Power Supply', 10),
  ('Computer Hardware', 'CPU Cooler', 11),

  ('Network Equipment', 'Patch Cord', 1), ('Network Equipment', 'LAN Cable', 2),
  ('Network Equipment', 'RJ45 Connector', 3), ('Network Equipment', 'Network Switch', 4),
  ('Network Equipment', 'Wireless Access Point', 5), ('Network Equipment', 'Router', 6),
  ('Network Equipment', 'Wi-Fi Adapter', 7), ('Network Equipment', 'Network Card', 8),

  ('Power & Electrical Accessories', 'Power Cord', 1), ('Power & Electrical Accessories', 'Power Adapter', 2),
  ('Power & Electrical Accessories', 'UPS', 3), ('Power & Electrical Accessories', 'UPS Battery', 4),
  ('Power & Electrical Accessories', 'Extension Board', 5), ('Power & Electrical Accessories', 'Power Cable', 6),
  ('Power & Electrical Accessories', 'Surge Protector', 7),

  ('Printer & Office IT Equipment', 'Printer', 1), ('Printer & Office IT Equipment', 'Barcode Scanner', 2),
  ('Printer & Office IT Equipment', 'Barcode Label Roll', 3), ('Printer & Office IT Equipment', 'Thermal Receipt Printer', 4),
  ('Printer & Office IT Equipment', 'Zebra Printer Ribbon', 5), ('Printer & Office IT Equipment', 'Printer Toner', 6),
  ('Printer & Office IT Equipment', 'Printer Cartridge', 7),

  ('Other IT Equipment', 'IP Phone', 1), ('Other IT Equipment', 'CCTV Camera', 2),
  ('Other IT Equipment', 'Webcam', 3), ('Other IT Equipment', 'Biometric Device', 4),
  ('Other IT Equipment', 'USB Flash Drive', 5), ('Other IT Equipment', 'External Hard Drive', 6),
  ('Other IT Equipment', 'Other IT Equipment', 7)
) as i(cat, name, ord)
join public.equipment_categories c on c.name = i.cat
on conflict do nothing;

-- ---------- system settings ----------
insert into public.system_settings (key, value, is_public) values
  ('site_name',         '"ROYAL POWER"'::jsonb,                          true),
  ('tagline',           '"Smart IT Support & Asset Management"'::jsonb,  true),
  ('company_logo_url',  '""'::jsonb,                                     true),
  ('support_email',     '"it-support@royalpower.local"'::jsonb,          true),
  ('support_phone',     '"+92 21 0000 0000"'::jsonb,                     true),
  ('support_hours',     '"Mon – Fri, 9:00 AM – 6:00 PM"'::jsonb,         true),
  ('support_location',  '"IT Helpdesk, Head Office"'::jsonb,             true),
  ('default_priority',  '"medium"'::jsonb,                               true),
  ('allow_attachments', 'true'::jsonb,                                   true),
  ('ticket_prefix',     '"RP"'::jsonb,                                   false),
  ('tickets_per_page',  '10'::jsonb,                                     false)
on conflict (key) do nothing;
