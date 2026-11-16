// Candidate provisioning policy. Never invoked automatically against main.
export function securityPolicy(app: string, owner: string) {
  if (!/^aurel_app_security_[a-f0-9]{12}$/.test(app) || !/^aurel_owner_security_[a-f0-9]{12}$/.test(owner)) throw new Error("Only isolated security-test roles are supported");
  return `
REVOKE CREATE ON SCHEMA public FROM PUBLIC;
GRANT USAGE ON SCHEMA public TO "${app}";
GRANT SELECT,INSERT ON public."User" TO "${app}";
GRANT UPDATE ("fullName",email,"emailVerified",image,"updatedAt") ON public."User" TO "${app}";
GRANT SELECT,INSERT,UPDATE,DELETE ON public."Account",public."Session",public."Verification",public."Category",public."ProductImage",public."ProductPrice" TO "${app}";
GRANT SELECT,INSERT,UPDATE ON public."Product",public."ProductVariant" TO "${app}";
GRANT SELECT ON public."Order",public."OrderItem" TO "${app}";
GRANT USAGE ON SEQUENCE public."User_id_seq",public."Account_id_seq",public."Session_id_seq",public."Verification_id_seq",public."Category_id_seq",public."Product_id_seq",public."ProductVariant_id_seq",public."ProductImage_id_seq",public."ProductPrice_id_seq" TO "${app}";
ALTER DEFAULT PRIVILEGES FOR ROLE "${owner}" REVOKE EXECUTE ON FUNCTIONS FROM PUBLIC;
CREATE FUNCTION public.guard_runtime_user_role() RETURNS TRIGGER LANGUAGE plpgsql SECURITY INVOKER
 SET search_path=pg_catalog,pg_temp AS $$
BEGIN
 IF current_user = '${app}' AND NEW.role IS DISTINCT FROM 'CUSTOMER'::public."UserRole" THEN
   RAISE EXCEPTION 'Runtime signup role must be CUSTOMER' USING ERRCODE='42501';
 END IF;
 RETURN NEW;
END; $$;
REVOKE ALL ON FUNCTION public.guard_runtime_user_role() FROM PUBLIC;
CREATE TRIGGER "User_runtime_signup_role" BEFORE INSERT ON public."User"
 FOR EACH ROW EXECUTE FUNCTION public.guard_runtime_user_role();
`;
}
