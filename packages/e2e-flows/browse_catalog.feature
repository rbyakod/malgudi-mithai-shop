# packages/e2e-flows/browse_catalog.feature — Task 12.1.
# Offline-first browsing flow. Maestro translation:
# apps/android/maestro/browse_catalog.yaml.

Feature: Browse the catalog
  As a customer
  I want to find sweets my family can eat
  So that I can order something suitable quickly

  Scenario: Search and filter the catalog
    Given the catalog has synced at least once
    When I open the Catalog tab
    Then I see a grid of sweets
    When I search by partial name
    Then only matching sweets are shown
    When I apply a dietary filter
    Then every visible card carries that tag
    When I clear all filters
    Then the full grid returns

  Scenario: Product detail
    When I tap a product card
    Then I see its gallery, price, and details
    When I increase the quantity and add it to the cart
    Then I return to where I was and the cart badge counts one
