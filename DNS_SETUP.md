# DNS Setup Guide for LFR Dashboard

## Option 1: Local Testing (Hosts File)

If you want to test your domain locally on your Mac:

1. **Edit your hosts file:**
   ```bash
   sudo nano /etc/hosts
   ```

2. **Add this line (replace with your actual domain):**
   ```
   127.0.0.1    yourdomain.com
   127.0.0.1    www.yourdomain.com
   ```

3. **Update Next.js to accept the domain:**
   - The dev server will automatically accept requests from any hostname
   - Access at: `http://yourdomain.com:3000`

## Option 2: Production Deployment DNS Records

### For Vercel Deployment:
- **Record Type:** CNAME
- **Name:** @ (or www)
- **Value:** cname.vercel-dns.com
- **OR** use A record pointing to Vercel's IP addresses

### For Custom Server/Cloud Hosting:
- **Record Type:** A
- **Name:** @ (root domain) or subdomain (e.g., dashboard)
- **Value:** Your server's public IP address
- **TTL:** 3600 (or default)

### For Cloudflare/Other DNS Providers:
- **Record Type:** A (for IP) or CNAME (for subdomain)
- **Name:** @ or your subdomain
- **Value:** Your hosting provider's IP or CNAME target
- **Proxy:** Enable if using Cloudflare (recommended)

## DNS Records You Need:

### Basic Setup:
```
Type    Name           Value                    TTL
A       @              YOUR_SERVER_IP           3600
A       www            YOUR_SERVER_IP           3600
```

### Subdomain Setup (e.g., dashboard.yourdomain.com):
```
Type    Name           Value                    TTL
A       dashboard      YOUR_SERVER_IP           3600
```

### CNAME Alternative (if using a service):
```
Type    Name           Value                    TTL
CNAME   @              your-hosting-provider    3600
CNAME   www            your-hosting-provider    3600
```

## Next.js Configuration

The app is already configured to work with any domain. No additional Next.js config needed.

## After DNS Setup:

1. **Wait for DNS propagation** (can take 5 minutes to 48 hours)
2. **Check DNS propagation:** Use https://dnschecker.org
3. **Test your domain:** Visit your domain in a browser
4. **SSL Certificate:** If deploying, ensure SSL/HTTPS is set up (Let's Encrypt, Cloudflare, etc.)

## Important Notes:

- **Local IP (10.0.0.15) is private** - DNS can't point to it from outside your network
- **For external access:** You need a public IP or hosting service
- **For local testing:** Use hosts file method
- **For production:** Deploy to Vercel, AWS, DigitalOcean, etc.

