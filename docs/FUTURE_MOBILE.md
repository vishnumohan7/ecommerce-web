# Future mobile client

A native client should use `/api/v1/auth/login`, rotating `/refresh`, OTP login, catalogue/search, cart, age verification, delivery, checkout/payment, orders/tracking, profile/addresses, wishlist, reviews, notifications and privacy endpoints. Store refresh tokens only in OS secure storage and access tokens only in memory.

Push registration uses `POST /api/v1/devices` and removal uses `DELETE /api/v1/devices/:id`. The provider boundary can be extended for opaque APNS/FCM tokens without changing commerce APIs. The release OpenAPI snapshot is `docs/openapi-v1.json`; breaking `/api/v1` changes require a new major API version.
