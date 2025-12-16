import requests
import uuid

BASE_URL = "http://localhost:3000"
TIMEOUT = 30
HEADERS_JSON = {"Content-Type": "application/json"}

def create_tenant_and_store(tenant_name):
    # Register tenant (simulated via POST /tenants)
    tenant_payload = {"name": tenant_name}
    r_tenant = requests.post(f"{BASE_URL}/tenants", json=tenant_payload, headers=HEADERS_JSON, timeout=TIMEOUT)
    r_tenant.raise_for_status()
    tenant_id = r_tenant.json().get("id")
    assert tenant_id, "Tenant creation failed, no ID returned"

    # Setup store under tenant (simulated via POST /tenants/{tenant_id}/stores)
    store_payload = {
        "name": f"{tenant_name} Store",
        "address": "123 Tenant St"
    }
    r_store = requests.post(f"{BASE_URL}/tenants/{tenant_id}/stores", json=store_payload, headers=HEADERS_JSON, timeout=TIMEOUT)
    r_store.raise_for_status()
    store_id = r_store.json().get("id")
    assert store_id, "Store creation failed, no ID returned"

    return tenant_id, store_id

def create_product_for_tenant(tenant_id, store_id, product_name):
    # Create product under tenant/store context (POST /tenants/{tenant_id}/stores/{store_id}/products)
    product_payload = {
        "name": product_name,
        "price": 9.99,
        "sku": str(uuid.uuid4())
    }
    r = requests.post(f"{BASE_URL}/tenants/{tenant_id}/stores/{store_id}/products", json=product_payload, headers=HEADERS_JSON, timeout=TIMEOUT)
    r.raise_for_status()
    product_id = r.json().get("id")
    assert product_id, "Product creation failed, no ID returned"
    return product_id

def get_products_for_tenant(tenant_id, store_id):
    # Retrieve products under tenant/store context (GET /tenants/{tenant_id}/stores/{store_id}/products)
    r = requests.get(f"{BASE_URL}/tenants/{tenant_id}/stores/{store_id}/products", headers=HEADERS_JSON, timeout=TIMEOUT)
    r.raise_for_status()
    return r.json()

def delete_product(tenant_id, store_id, product_id):
    requests.delete(f"{BASE_URL}/tenants/{tenant_id}/stores/{store_id}/products/{product_id}", headers=HEADERS_JSON, timeout=TIMEOUT)

def delete_store(tenant_id, store_id):
    requests.delete(f"{BASE_URL}/tenants/{tenant_id}/stores/{store_id}", headers=HEADERS_JSON, timeout=TIMEOUT)

def delete_tenant(tenant_id):
    requests.delete(f"{BASE_URL}/tenants/{tenant_id}", headers=HEADERS_JSON, timeout=TIMEOUT)

def test_validate_multi_tenant_data_isolation():
    tenant1_name = f"TenantA-{uuid.uuid4()}"
    tenant2_name = f"TenantB-{uuid.uuid4()}"

    tenant1_id = tenant1_store_id = None
    tenant2_id = tenant2_store_id = None
    tenant1_product_id = None
    tenant2_product_id = None

    try:
        # Create first tenant and store
        tenant1_id, tenant1_store_id = create_tenant_and_store(tenant1_name)
        # Create second tenant and store
        tenant2_id, tenant2_store_id = create_tenant_and_store(tenant2_name)

        # Create product in tenant 1
        tenant1_product_id = create_product_for_tenant(tenant1_id, tenant1_store_id, "Tenant1 Product")

        # Create product in tenant 2
        tenant2_product_id = create_product_for_tenant(tenant2_id, tenant2_store_id, "Tenant2 Product")

        # Fetch products for tenant 1, expect to see only tenant1_product_id
        tenant1_products = get_products_for_tenant(tenant1_id, tenant1_store_id)
        tenant1_product_ids = [p.get("id") for p in tenant1_products]
        assert tenant1_product_id in tenant1_product_ids, "Tenant 1 product missing in tenant 1 product list"
        assert tenant2_product_id not in tenant1_product_ids, "Tenant 1 product list contains tenant 2's product"

        # Fetch products for tenant 2, expect to see only tenant2_product_id
        tenant2_products = get_products_for_tenant(tenant2_id, tenant2_store_id)
        tenant2_product_ids = [p.get("id") for p in tenant2_products]
        assert tenant2_product_id in tenant2_product_ids, "Tenant 2 product missing in tenant 2 product list"
        assert tenant1_product_id not in tenant2_product_ids, "Tenant 2 product list contains tenant 1's product"

    finally:
        # Cleanup
        if tenant1_product_id and tenant1_id and tenant1_store_id:
            try:
                delete_product(tenant1_id, tenant1_store_id, tenant1_product_id)
            except Exception:
                pass
        if tenant2_product_id and tenant2_id and tenant2_store_id:
            try:
                delete_product(tenant2_id, tenant2_store_id, tenant2_product_id)
            except Exception:
                pass
        if tenant1_store_id and tenant1_id:
            try:
                delete_store(tenant1_id, tenant1_store_id)
            except Exception:
                pass
        if tenant2_store_id and tenant2_id:
            try:
                delete_store(tenant2_id, tenant2_store_id)
            except Exception:
                pass
        if tenant1_id:
            try:
                delete_tenant(tenant1_id)
            except Exception:
                pass
        if tenant2_id:
            try:
                delete_tenant(tenant2_id)
            except Exception:
                pass

test_validate_multi_tenant_data_isolation()