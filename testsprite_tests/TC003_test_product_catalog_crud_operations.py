import requests

BASE_URL = "http://localhost:3000"
TIMEOUT = 30
HEADERS = {
    'Content-Type': 'application/json'
}

def test_product_catalog_crud_operations():
    product_data = {
        "name": "Test Product",
        "description": "A product created for testing.",
        "price": 19.99,
        "sku": "TESTSKU123",
        "stock": 100,
        "category": "Test Category"
    }
    updated_product_data = {
        "name": "Updated Test Product",
        "description": "An updated product description.",
        "price": 24.99,
        "sku": "TESTSKU123",
        "stock": 80,
        "category": "Updated Category"
    }

    created_product_id = None
    try:
        # Create Product
        create_resp = requests.post(
            f"{BASE_URL}/api/products",
            json=product_data,
            headers=HEADERS,
            timeout=TIMEOUT
        )
        assert create_resp.status_code == 201, f"Create product failed: {create_resp.text}"
        created_product = create_resp.json()
        assert "id" in created_product, "Created product has no ID"
        created_product_id = created_product["id"]

        # Read/Get Product - verify it exists and data matches
        get_resp = requests.get(
            f"{BASE_URL}/api/products/{created_product_id}",
            headers=HEADERS,
            timeout=TIMEOUT
        )
        assert get_resp.status_code == 200, f"Get product failed: {get_resp.text}"
        got_product = get_resp.json()
        for key in product_data:
            assert got_product.get(key) == product_data[key], f"Product field {key} mismatch on GET"

        # Update Product
        update_resp = requests.put(
            f"{BASE_URL}/api/products/{created_product_id}",
            json=updated_product_data,
            headers=HEADERS,
            timeout=TIMEOUT
        )
        assert update_resp.status_code == 200, f"Update product failed: {update_resp.text}"
        updated_product = update_resp.json()
        for key in updated_product_data:
            assert updated_product.get(key) == updated_product_data[key], f"Product field {key} mismatch on UPDATE"

        # Confirm update is reflected in GET
        get_updated_resp = requests.get(
            f"{BASE_URL}/api/products/{created_product_id}",
            headers=HEADERS,
            timeout=TIMEOUT
        )
        assert get_updated_resp.status_code == 200, f"Get updated product failed: {get_updated_resp.text}"
        got_updated_product = get_updated_resp.json()
        for key in updated_product_data:
            assert got_updated_product.get(key) == updated_product_data[key], f"Product field {key} mismatch after update"

        # Verify product appears in catalog listing (product management page)
        catalog_resp = requests.get(
            f"{BASE_URL}/api/products",
            headers=HEADERS,
            timeout=TIMEOUT
        )
        assert catalog_resp.status_code == 200, f"Get product catalog failed: {catalog_resp.text}"
        catalog = catalog_resp.json()
        product_ids = [p.get("id") for p in catalog]
        assert created_product_id in product_ids, "Product not found in product catalog listing"

        # Verify product appears in sales page product listing
        sales_products_resp = requests.get(
            f"{BASE_URL}/api/sales/products",
            headers=HEADERS,
            timeout=TIMEOUT
        )
        assert sales_products_resp.status_code == 200, f"Get sales page products failed: {sales_products_resp.text}"
        sales_products = sales_products_resp.json()
        sales_product_ids = [p.get("id") for p in sales_products]
        assert created_product_id in sales_product_ids, "Product not found in sales page product listing"

    finally:
        if created_product_id:
            # Delete Product
            delete_resp = requests.delete(
                f"{BASE_URL}/api/products/{created_product_id}",
                headers=HEADERS,
                timeout=TIMEOUT
            )
            assert delete_resp.status_code in [200, 204], f"Delete product failed: {delete_resp.text}"

            # Verify deletion reflected in catalog
            catalog_resp_after_delete = requests.get(
                f"{BASE_URL}/api/products",
                headers=HEADERS,
                timeout=TIMEOUT
            )
            if catalog_resp_after_delete.status_code == 200:
                catalog_after_delete = catalog_resp_after_delete.json()
                product_ids_after_delete = [p.get("id") for p in catalog_after_delete]
                assert created_product_id not in product_ids_after_delete, "Product still found in catalog after deletion"

            # Verify deletion reflected in sales page
            sales_products_resp_after_delete = requests.get(
                f"{BASE_URL}/api/sales/products",
                headers=HEADERS,
                timeout=TIMEOUT
            )
            if sales_products_resp_after_delete.status_code == 200:
                sales_products_after_delete = sales_products_resp_after_delete.json()
                sales_product_ids_after_delete = [p.get("id") for p in sales_products_after_delete]
                assert created_product_id not in sales_product_ids_after_delete, "Product still found in sales page after deletion"

test_product_catalog_crud_operations()