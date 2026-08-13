# packages/e2e-flows/login_checkout.feature — Task 12.1.
# Source-of-truth Gherkin for the highest-value flow: login → browse →
# cart → checkout → Razorpay (test mode) → confirmation. Maestro's
# apps/android/maestro/login_checkout.yaml is the Android translation.

Feature: Login and checkout
  As a customer with a serviceable address
  I want to sign in with my phone and pay for a cart of sweets
  So that my order is confirmed for the chosen delivery slot

  Background:
    Given the staging backend is reachable
    And Razorpay is running in test mode
    And I have a saved address with a serviceable fresh-tier pincode

  Scenario: Phone login via OTP
    When I open the app signed out
    And I enter my phone number
    And I request a code
    Then I see the OTP entry screen
    When I enter the staging OTP
    Then I am signed in and land on Home

  Scenario: Full checkout with Razorpay test payment
    Given I am signed in
    When I browse the catalog
    And I open a product and add it to the cart
    And I go to the cart and choose Checkout
    And I select my address and a delivery slot
    And I place the order and complete the Razorpay test payment
    Then I see the order confirmation screen
    And the order appears in Orders with a Confirmed status
