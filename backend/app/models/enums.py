"""String enumerations shared by models, schemas and API. The API only ever
returns these codes; human readable labels live in the frontend locale files."""

ROLES = ("buyer", "private_seller", "dealer", "admin")
SELF_ASSIGNABLE_ROLES = ("buyer", "private_seller", "dealer")

CATEGORIES = ("jolle", "sportboot", "kielboot", "daysailer", "segelyacht", "katamaran", "regattaboot")
CONDITIONS = ("used", "refurbished", "restored")
REFURB_STATUSES = ("none", "documentation_available", "inspection_documented", "work_completed")
BOAT_STATUSES = ("draft", "pending", "active", "paused", "rejected", "archived", "removed")
SELLER_TYPES = ("private", "dealer", "verified_dealer")

DEALER_VERIFICATION = ("unverified", "business_checked", "verified", "refurb_documented")
VERIFIED_DEALER_STATUSES = ("verified", "refurb_documented")

REPORT_SECTIONS = ("hull", "deck", "rigging", "sails", "fittings", "electronics", "engine", "interior", "other")
ENTRY_STATUSES = ("inspected", "renewed", "repaired", "not_inspected", "defect_reported")
REPORT_VERIFICATION = ("seller_provided", "independently_verified")

EQUIPMENT_KINDS = ("main_sail", "jib", "genoa", "spinnaker", "gennaker", "electronics", "other")
MESSAGE_KINDS = ("message", "viewing_request", "info_request")
LISTING_REPORT_REASONS = ("fraud", "wrong_information", "duplicate", "inappropriate", "other")
LISTING_REPORT_STATUSES = ("open", "resolved", "dismissed")
