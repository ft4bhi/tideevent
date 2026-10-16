"""Test-wide fixtures: throttle isolation.

The suite makes dozens of auth POSTs per minute; the production 10/min auth
throttle would false-positive. Tests run with a generous rate (the dedicated
throttle test narrows it itself), and the cache is cleared for isolation.
"""

from unittest import mock

import pytest
from django.core.cache import cache


@pytest.fixture(autouse=True)
def generous_auth_throttle():
    from apps.accounts.views import AuthThrottle

    cache.clear()
    with mock.patch.object(AuthThrottle, "THROTTLE_RATES", {"auth": "1000/min"}):
        yield
    cache.clear()
