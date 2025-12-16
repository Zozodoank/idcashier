import requests
import uuid

BASE_URL = "http://localhost:3000"
TIMEOUT = 30


def validate_sales_transaction_processing():
    # Generate a tenant id for multi-tenancy
    tenant_id = str(uuid.uuid4())

    HEADERS = {
        "Content-Type": "application/json",
        "X-Tenant-ID": tenant_id
    }

    # Step 1: Create a sample product to sell
    product_payload = {
        "name": "Test Product " + str(uuid.uuid4()),
        "description": "Sample product for sales transaction testing",
        "price": 9.99,
        "stock": 100,
        "sku": "SKU-" + str(uuid.uuid4())[:8]
    }

    product_id = None
    transaction_id = None

    try:
        product_resp = requests.post(
            f"{BASE_URL}/products",
            json=product_payload,
            headers=HEADERS,
            timeout=TIMEOUT
        )
        assert product_resp.status_code == 201, f"Product creation failed: {product_resp.text}"
        product_data = product_resp.json()
        product_id = product_data.get("id")
        assert product_id is not None, "Product ID not returned"

        # Step 2: Create a sales transaction with this product
        transaction_payload = {
            "items": [
                {
                    "product_id": product_id,
                    "quantity": 2,
                    "unit_price": product_payload["price"]
                }
            ],
            "payment_method": "cash",
            "customer": {
                "name": "John Doe",
                "email": "john.doe@example.com"
            }
        }

        transaction_resp = requests.post(
            f"{BASE_URL}/sales/transactions",
            json=transaction_payload,
            headers=HEADERS,
            timeout=TIMEOUT
        )
        assert transaction_resp.status_code == 201, f"Transaction creation failed: {transaction_resp.text}"
        transaction_data = transaction_resp.json()
        transaction_id = transaction_data.get("id")
        assert transaction_id is not None, "Transaction ID not returned"
        assert "receipt_url" in transaction_data, "Receipt URL missing in response"
        assert transaction_data["items"][0]["product_id"] == product_id, "Transaction item product ID mismatch"
        assert transaction_data["items"][0]["quantity"] == 2, "Transaction item quantity mismatch"

        # Step 3: Retrieve the transaction to verify it was recorded correctly
        get_transaction_resp = requests.get(
            f"{BASE_URL}/sales/transactions/{transaction_id}",
            headers=HEADERS,
            timeout=TIMEOUT
        )
        assert get_transaction_resp.status_code == 200, f"Failed to retrieve transaction: {get_transaction_resp.text}"
        get_transaction_data = get_transaction_resp.json()
        assert get_transaction_data["id"] == transaction_id, "Transaction ID mismatch on retrieval"
        assert get_transaction_data["items"][0]["product_id"] == product_id, "Retrieved transaction product ID mismatch"

        # Step 4: Simulate receipt printing by accessing receipt URL
        receipt_url = transaction_data["receipt_url"]
        receipt_resp = requests.get(receipt_url, headers=HEADERS, timeout=TIMEOUT)
        assert receipt_resp.status_code == 200, f"Receipt retrieval failed: {receipt_resp.text}"
        assert receipt_resp.headers.get("content-type", "").startswith("application/pdf") or receipt_resp.headers.get("content-type", "").startswith("text/html"), "Receipt content type unexpected"

    finally:
        # Cleanup: Delete the transaction if possible
        if transaction_id:
            try:
                del_transaction_resp = requests.delete(
                    f"{BASE_URL}/sales/transactions/{transaction_id}",
                    headers=HEADERS,
                    timeout=TIMEOUT
                )
                assert del_transaction_resp.status_code in [200, 204], f"Failed to delete transaction: {del_transaction_resp.text}"
            except Exception:
                pass

        # Cleanup: Delete the product created for the test
        if product_id:
            try:
                del_product_resp = requests.delete(
                    f"{BASE_URL}/products/{product_id}",
                    headers=HEADERS,
                    timeout=TIMEOUT
                )
                assert del_product_resp.status_code in [200, 204], f"Failed to delete product: {del_product_resp.text}"
            except Exception:
                pass


validate_sales_transaction_processing()
