-- Function to increment product scan count
CREATE OR REPLACE FUNCTION increment_scan_count(product_code TEXT)
RETURNS VOID AS $$
BEGIN
  UPDATE public.products
  SET scan_count = scan_count + 1
  WHERE code = product_code;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
