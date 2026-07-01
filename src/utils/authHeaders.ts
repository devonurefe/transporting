/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

/**
 * Auth headers for admin-only fetch calls (always reads the admin token,
 * unlike the customer/admin dual-mode lookup used elsewhere in the app).
 * Pass withContentType for JSON POST/PUT bodies.
 */
export const getAdminAuthHeaders = (withContentType = false): Record<string, string> => {
  const token = localStorage.getItem("hwh_admin_token");
  const headers: Record<string, string> = token ? { Authorization: `Bearer ${token}` } : {};
  if (withContentType) headers["Content-Type"] = "application/json";
  return headers;
};
