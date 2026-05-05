# Local Domain Setup for lfrpro.com

## Quick Setup

Run this command in your terminal (you'll need to enter your password):

```bash
./setup-local-domain.sh
```

Or manually edit your hosts file:

```bash
sudo nano /etc/hosts
```

Add these lines at the end:
```
127.0.0.1    lfrpro.com
127.0.0.1    www.lfrpro.com
```

Save and exit (Ctrl+X, then Y, then Enter).

## Start Your Server

The Next.js dev server is already running, but if you need to restart it:

```bash
npm run dev
```

Or to explicitly bind to the domain:

```bash
npm run dev:domain
```

## Access Your App

Once the hosts file is updated, you can access your dashboard at:

- **http://lfrpro.com:3000**
- **http://www.lfrpro.com:3000**

## Verify Setup

To check if the hosts file was updated correctly:

```bash
cat /etc/hosts | grep lfrpro
```

You should see:
```
127.0.0.1    lfrpro.com
127.0.0.1    www.lfrpro.com
```

## Troubleshooting

1. **Can't access the domain:**
   - Make sure you added the entries to `/etc/hosts`
   - Clear your browser cache
   - Try a different browser or incognito mode
   - Restart your browser

2. **Port 3000 not accessible:**
   - Make sure the dev server is running: `npm run dev`
   - Check if port 3000 is in use: `lsof -ti:3000`

3. **DNS still resolving to external IP:**
   - Flush DNS cache: `sudo dscacheutil -flushcache; sudo killall -HUP mDNSResponder`
   - Wait a few minutes for DNS cache to clear

## Notes

- This setup only works on your local computer
- Other devices on your network won't be able to access via lfrpro.com
- For external access, you'll need to deploy to a hosting service
- The domain will work locally even if you don't own it (for testing purposes)

