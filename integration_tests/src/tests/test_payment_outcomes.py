"""Outcome classification checks; these do not start a browser or call Stripe."""
from types import SimpleNamespace
import unittest

from selenium.common.exceptions import (
    ElementNotInteractableException, NoSuchElementException, TimeoutException,
)

from payment_test_utils import PaymentBrowserTestCase


class TestPaymentOutcomes(unittest.TestCase):
    def make_case(self, url="https://checkout.stripe.com/test"):
        case = PaymentBrowserTestCase()
        case.driver = SimpleNamespace(current_url=url)
        return case

    def test_unexpected_hosted_interaction_skips(self):
        for error_type in (TimeoutException, NoSuchElementException, ElementNotInteractableException):
            with self.subTest(error=error_type.__name__):
                case = self.make_case()
                with self.assertRaisesRegex(unittest.SkipTest, "INCONCLUSIVE: Card interaction"):
                    with case.stripe_interaction("Card interaction"):
                        raise error_type()

    def test_our_callback_and_api_timeouts_still_fail(self):
        for url in (
            "https://app.beddybytes.local/payment/callback",
            "https://api.local.beddybytes.com/payment/stripe/success",
            "https://stripe.com.example.org/test",
        ):
            with self.subTest(url=url):
                case = self.make_case(url)
                with self.assertRaises(TimeoutException):
                    with case.stripe_interaction("Return"):
                        raise TimeoutException()

    def test_license_assertions_are_not_converted_to_skips(self):
        case = self.make_case()
        with self.assertRaisesRegex(AssertionError, "Incorrect license"):
            with case.stripe_interaction("Decline"):
                raise AssertionError("Incorrect license")

    def test_account_assertion_runs_before_inconclusive_skip(self):
        case = self.make_case()
        checked = []
        with self.assertRaises(unittest.SkipTest):
            with case.stripe_interaction("Decline", before_skip=lambda: checked.append(True)):
                raise TimeoutException()
        self.assertEqual(checked, [True])

    def test_bad_account_state_prevents_skip(self):
        case = self.make_case()

        def check_account():
            raise AssertionError("Trial unexpectedly upgraded")

        with self.assertRaisesRegex(AssertionError, "Trial unexpectedly upgraded"):
            with case.stripe_interaction("Decline", before_skip=check_account):
                raise TimeoutException()
