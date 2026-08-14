# packages/e2e-flows/track_order.feature — Task 12.1.
# Order tracking flow incl. the push deep link. Maestro translation:
# apps/android/maestro/track_order.yaml.

Feature: Track an order
  As a customer with a placed order
  I want to see where my sweets are
  So that I can plan to be home for the delivery slot

  Scenario: Track from the Orders tab
    Given I have an order in progress
    When I open the Orders tab
    Then I see my order with its current status and total
    When I tap the order
    Then I see its timeline, items, and totals

  Scenario: Deep link from a push notification
    Given a stage-change push arrived for my order
    When I tap the notification
    Then the app opens directly on that order's detail screen
