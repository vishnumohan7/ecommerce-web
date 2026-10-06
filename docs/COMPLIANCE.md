# Alcohol and Age-Verification Compliance

This document records product controls and implementation assumptions. It is not legal advice. The merchant must have its premises licence, operating schedule, delivery policy, provider selection, and local conditions reviewed before production launch.

## Implemented controls

- The storefront browsing gate is a UX control only. It never grants permission to purchase.
- Checkout separately requires a non-expired `PASSED` age-verification record whenever any cart line has `ageRestriction > 0`.
- The delivery postcode resolves an admin-editable jurisdiction rule. Sale and prohibited-delivery windows use `Europe/London`, including daylight-saving changes.
- Scottish off-sales default to 10:00–22:00. The statutory rule is that a Licensing Board must refuse proposed off-sales hours before 10:00 or after 22:00; the merchant's actual licensed hours may be narrower.
- The default challenge age is policy data, not the legal minimum age. Challenge 25 can be configured independently by jurisdiction.
- Direct DOB declarations are stored only on the age-verification record and are never returned downstream or included in audit payloads.
- Digital-verification documents, images, document numbers, and raw provider evidence are never stored. Only status, age threshold, method, provider reference, and timestamps are retained.
- Delivery handover age checks remain required by the fulfilment milestone; online verification does not remove the merchant's delivery obligations.

## Digital proof of age

England and Wales permit qualifying digital proof of age from 15 September 2026. Production use remains disabled until the merchant supplies credentials and confirms that the chosen service and transaction flow meet the applicable registration/certification requirements. The Yoti adapter stores no identity-document data.

## Authoritative references checked 2026-10-06

- [Home Office mandatory age-verification conditions](https://www.gov.uk/government/publications/new-conditions-for-licensed-premises-in-england-and-wales-age-verification-and-smaller-measures)
- [September 2026 Licensing Act section 182 guidance](https://www.gov.uk/government/publications/explanatory-memorandum-revised-guidance-issued-under-s-182-of-licensing-act-2003/revised-guidance-issued-under-section-182-of-the-licensing-act-2003-september-2026-accessible-version)
- [Licensing (Scotland) Act 2005, including sections 62–65](https://www.legislation.gov.uk/asp/2005/16/contents)
- [Government announcement enabling digital proof of age](https://www.gov.uk/government/news/new-rules-pave-the-way-for-businesses-to-adopt-digital-proof-of-age-for-alcohol-sales)
- [Register of digital verification services](https://www.gov.uk/guidance/find-registered-digital-verification-services)
