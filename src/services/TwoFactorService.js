const axios = require("axios");
require("dotenv").config();

const API_KEY = process.env["MFA_SECRET_KEY"];
const BASE_URL = "https://2factor.in/API/V1";

const sendOtp = async (phoneNumber) => {
  if (!API_KEY) {
    throw new Error("2Factor API Key is missing in environment variables");
  }

  // Ensure phone number doesn't have +91 or 91 prefix if we are adding it,
  // OR just use the input if we trust it.
  // Let's sanitize: remove all non-numeric characters.
  const cleanPhone = phoneNumber.toString().replace(/\D/g, "");

  // If length is 10, add 91. If length is 12 and starts with 91, keep it.
  let formattedPhone = cleanPhone;
  if (cleanPhone.length === 10) {
    formattedPhone = `91${cleanPhone}`;
  }

  try {
    const url = `${BASE_URL}/${API_KEY}/SMS/${formattedPhone}/AUTOGEN//OTP1`;
    console.log(
      `Sending OTP to: ${formattedPhone} with URL: ${url.replace(
        API_KEY,
        "***"
      )}`
    );

    const response = await axios.get(url);
    // 2Factor Response Status: "Success" or "Error"
    // Details: Session ID or error message
    console.log(
      "2Factor Response Full Data:",
      JSON.stringify(response.data, null, 2)
    );

    if (response.data.Status !== "Success") {
      console.warn("2Factor returned a non-success status:", response.data);
    }

    return response.data;
  } catch (error) {
    console.error(
      "Error sending OTP via 2Factor:",
      error.response ? error.response.data : error.message
    );
    throw new Error("Failed to send OTP");
  }
};

const verifyOtp = async (sessionId, otp) => {
  if (!API_KEY) {
    throw new Error("2Factor API Key is missing in environment variables");
  }

  try {
    const url = `${BASE_URL}/${API_KEY}/SMS/VERIFY/${sessionId}/${otp}`;
    const response = await axios.get(url);
    return response.data;
  } catch (error) {
    console.error(
      "Error verifying OTP via 2Factor:",
      error.response ? error.response.data : error.message
    );
    // 2Factor returns 200 even for failure sometimes with Details mismatch, so we might need to check response.data.Status
    // But typically axios throws on 4xx/5xx.
    // If 2Factor returns a 200 with "Details not matched", we should handle it.
    if (error.response && error.response.data) {
      return error.response.data; // Return the error response to be handled by controller
    }
    throw new Error("Failed to verify OTP");
  }
};

module.exports = {
  sendOtp,
  verifyOtp,
};
