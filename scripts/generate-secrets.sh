#!/bin/bash

# Colors for output
GREEN='\033[0;32m'
BLUE='\033[0;34m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

echo -e "${BLUE}=== OpenWhispr GitHub Secrets Helper ===${NC}"
echo "This script will help you prepare your Apple Developer certificates for GitHub Actions."
echo ""

# Check if openssl is installed
if ! command -v openssl &> /dev/null; then
    echo "Error: openssl is not installed. Please install it first."
    exit 1
fi

echo -e "${YELLOW}Step 1: Developer ID Application Certificate (.p12)${NC}"
echo "1. Open 'Keychain Access' on your Mac."
echo "2. Find your 'Developer ID Application' certificate."
echo "3. Right-click it and select 'Export'."
echo "4. Save it as 'build_certificate.p12' (use a strong password)."
echo ""
read -p "Enter the path to your .p12 file (drag and drop here): " P12_PATH
# Remove quotes if present (both single and double)
P12_PATH="${P12_PATH%\"}"
P12_PATH="${P12_PATH#\"}"
P12_PATH="${P12_PATH%\'}"
P12_PATH="${P12_PATH#\'}"

if [ -f "$P12_PATH" ]; then
    echo "Converting certificate to Base64..."
    CERT_BASE64=$(base64 < "$P12_PATH")
    echo -e "${GREEN}Success! Copy the following line into GitHub Secret 'APPLE_CERTIFICATE_BASE64':${NC}"
    echo ""
    echo "$CERT_BASE64"
    echo ""
    echo -e "${YELLOW}Also add the password you used to export the .p12 as 'APPLE_CERTIFICATE_PASSWORD'.${NC}"
else
    echo "File not found: $P12_PATH"
fi

echo ""
echo -e "${YELLOW}Step 2: App Store Connect API Key (.p8)${NC}"
echo "1. Go to App Store Connect > Users and Access > Integrations > Team Keys."
echo "2. Generate a new key with 'App Manager' access."
echo "3. Download the .p8 file."
echo ""
read -p "Enter the path to your .p8 file (drag and drop here): " P8_PATH
# Remove quotes if present (both single and double)
P8_PATH="${P8_PATH%\"}"
P8_PATH="${P8_PATH#\"}"
P8_PATH="${P8_PATH%\'}"
P8_PATH="${P8_PATH#\'}"

if [ -f "$P8_PATH" ]; then
    echo "Converting API Key to Base64..."
    KEY_BASE64=$(base64 < "$P8_PATH")
    echo -e "${GREEN}Success! Copy the following line into GitHub Secret 'APPLE_API_KEY_BASE64':${NC}"
    echo ""
    echo "$KEY_BASE64"
    echo ""
    echo -e "${YELLOW}You also need to add these secrets:${NC}"
    echo "- APPLE_API_KEY_ID: (The Key ID from App Store Connect)"
    echo "- APPLE_API_ISSUER: (The Issuer ID from App Store Connect)"
else
    echo "File not found: $P8_PATH"
fi

echo ""
echo -e "${BLUE}=== Summary of Secrets to Add to GitHub ===${NC}"
echo "1. APPLE_CERTIFICATE_BASE64"
echo "2. APPLE_CERTIFICATE_PASSWORD"
echo "3. APPLE_API_KEY_BASE64"
echo "4. APPLE_API_KEY_ID"
echo "5. APPLE_API_ISSUER"
echo "6. APPLE_TEAM_ID (Your Team ID from Developer Portal)"
