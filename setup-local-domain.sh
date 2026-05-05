#!/bin/bash

# Setup script for local domain hosting
# This adds lfrpro.com to your hosts file

echo "Setting up lfrpro.com for local hosting..."
echo ""
echo "You'll need to enter your password to edit the hosts file."
echo ""

# Check if entries already exist
if grep -q "lfrpro.com" /etc/hosts; then
    echo "✓ lfrpro.com already exists in hosts file"
else
    echo "127.0.0.1    lfrpro.com" | sudo tee -a /etc/hosts
    echo "✓ Added lfrpro.com to hosts file"
fi

if grep -q "www.lfrpro.com" /etc/hosts; then
    echo "✓ www.lfrpro.com already exists in hosts file"
else
    echo "127.0.0.1    www.lfrpro.com" | sudo tee -a /etc/hosts
    echo "✓ Added www.lfrpro.com to hosts file"
fi

echo ""
echo "✓ Setup complete!"
echo ""
echo "You can now access your app at:"
echo "  http://lfrpro.com:3000"
echo "  http://www.lfrpro.com:3000"
echo ""
echo "To start the dev server, run: npm run dev"

