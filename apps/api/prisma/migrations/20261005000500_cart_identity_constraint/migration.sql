ALTER TABLE "Cart" ADD CONSTRAINT "Cart_exactly_one_owner_check"
  CHECK (num_nonnulls("userId", "guestToken") = 1) NOT VALID;
ALTER TABLE "Cart" VALIDATE CONSTRAINT "Cart_exactly_one_owner_check";
