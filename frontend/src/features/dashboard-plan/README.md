# Dashboard & Planner Feature

Customer interactive event planner, AI package calculation, dynamic cost tables, vendor directory browsing, and place filter controls.

## Contents
- `DashboardView.jsx`: Main authenticated customer dashboard coordinating the planning panels.
- `DashboardEventChips.jsx`: Celebration type selector with event theme color indicators.
- `DashboardFormPanel.jsx`: Left configuration panel (budget slider, guest counts, catering tiers).
- `DashboardPlanPanel.jsx`: Right AI plan panel (split progress bar, cost table, top recommendations).
- `DashboardVendorsCatalog.jsx`: City and district vendor catalog with place filter popover.
- `DashboardLocationModal.jsx`: Location switch modal for changing state and city.
- `VendorDetailPage.jsx`: Comprehensive branch profile, amenities, previous works gallery.
- `BranchPhotoPlaceholder.jsx` & `PhotoUploader.jsx`: Image rendering and photo management.
- `engine/`: Core client-side planning and budget optimization engine.
- `offline/`: Offline-capable planner engine and fallback static configs.
- `placeFilter.js`: Persistent district place filter store and toggle handlers.
- `dashboard-plan.css`: Dashboard, planner panels, sliders, and vendor catalog styling.
