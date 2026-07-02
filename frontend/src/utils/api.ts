const API_BASE_URL = "http://localhost:8080/api";

export async function apiRequest(
  endpoint: string,
  method: "GET" | "POST" | "PUT" | "DELETE" = "GET",
  body?: any
) {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  
  const headers: HeadersInit = {
    "Content-Type": "application/json",
  };

  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    method,
    headers,
    body: body ? JSON.stringify(body) : undefined,
  });

  if (response.status === 401) {
    // Session expired/invalid, clear token and redirect to login
    if (typeof window !== "undefined") {
      localStorage.removeItem("token");
      localStorage.removeItem("user_email");
      if (window.location.pathname !== "/auth") {
        window.location.href = "/auth";
      }
    }
    throw new Error("Unauthorized");
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Sesuatu salah terjadi");
  }

  // Handle empty responses
  if (response.status === 204) {
    return null;
  }

  try {
    return await response.json();
  } catch {
    return null;
  }
}

// Upload receipt files
export async function uploadReceiptRequest(
  file: File,
  transactionId: string
) {
  const token = typeof window !== "undefined" ? localStorage.getItem("token") : null;
  const formData = new FormData();
  formData.append("receipt", file);
  formData.append("transaction_id", transactionId);

  const headers: HeadersInit = {};
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }

  const response = await fetch(`${API_BASE_URL}/upload`, {
    method: "POST",
    headers,
    body: formData,
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(errorText || "Upload gagal");
  }

  return await response.json();
}
