# SMS Forwarder Setup Guide - Complete Step-by-Step

This guide will help you set up SMS forwarding from your phone to your backend database. By the end, every Mobile Money notification you receive will automatically be saved to your database, allowing users to verify top-ups using transaction IDs.

---

## Table of Contents

1. [What You Need](#what-you-need)
2. [Step 1: Install SMS Forwarder App](#step-1-install-sms-forwarder-app)
3. [Step 2: Configure the App](#step-2-configure-the-app)
4. [Step 3: Test the Connection](#step-3-test-the-connection)
5. [Step 4: Verify in Database](#step-4-verify-in-database)
6. [Troubleshooting](#troubleshooting)
7. [How It Works](#how-it-works)

---

## What You Need

Before you start, make sure you have:

- ✅ An Android phone (iPhone support varies)
- ✅ Your backend server URL (e.g., `https://your-backend.com` or `https://your-app.onrender.com`)
- ✅ Access to your database (to verify SMS is being saved)
- ✅ WiFi or mobile data connection
- ✅ 5-10 minutes of setup time

---

## Step 1: Install SMS Forwarder App

### Option A: Using Google Play Store (Easiest)

1. **Open Google Play Store** on your Android phone
   - Tap the Play Store icon (colorful triangle)

2. **Search for "SMS Forwarder"**
   - In the search box at the top, type: `SMS Forwarder`
   - Look for the app by **Zerogic Inc.** (most popular version with 500K+ downloads)
   - It should have a blue/dark icon
   - **Direct link:** Search for app ID `com.frzinapps.smsforward`

3. **Tap "Install"**
   - Wait for the app to download and install
   - This usually takes 30 seconds to 1 minute

4. **Open the App**
   - Once installed, tap "Open" or find the app icon on your home screen
   - The app will ask for permissions (we'll grant them next)

**Alternative Apps (if above not available):**
- **SMS Forwarder** by sms-forwarder.com (4.6 stars, 100K+ reviews)
- **Easy SMS Forwarder** (1.5M+ downloads, updated May 2025)
- **SMS to URL Forwarder** (free, open-source on F-Droid)

### Option B: Manual APK Installation

If SMS Forwarder is not available in your region:

1. Visit `https://www.apkmirror.com` on your phone
2. Search for "SMS Forwarder"
3. Download the latest APK file
4. Open the downloaded file and tap "Install"
5. Grant all permissions when prompted

---

## Step 2: Configure the App

### 2.1 Grant Permissions

When you first open SMS Forwarder, it will ask for permissions:

1. **"Allow SMS Forwarder to read your messages?"**
   - Tap **"Allow"** or **"Grant"**
   - This lets the app see incoming SMS

2. **"Allow SMS Forwarder to access your contacts?"**
   - Tap **"Allow"**
   - This helps identify who sent the SMS

3. **"Allow SMS Forwarder to access your location?"**
   - You can tap **"Deny"** (optional)

4. **"Allow SMS Forwarder to access your phone's storage?"**
   - Tap **"Allow"**

### 2.2 Set Up Webhook URL

Now you'll configure where to send the SMS data:

1. **Open SMS Forwarder app** (if not already open)

2. **Look for "Settings" or "Configuration"**
   - Tap the **menu icon** (three horizontal lines) in the top-left
   - Or look for a **gear icon** ⚙️

3. **Find "Webhook" or "HTTP" settings**
   - You should see an option like:
     - "Webhook URL"
     - "HTTP Endpoint"
     - "Server URL"
     - "API Endpoint"

4. **Enter Your Backend URL**
   - In the webhook URL field, enter:
   ```
   https://your-backend.com/api/sms
   ```
   
   **Replace `your-backend.com` with your actual backend URL:**
   - If using Render: `https://your-app-name.onrender.com/api/sms`
   - If using Railway: `https://your-app-name.up.railway.app/api/sms`
   - If using local testing: `http://192.168.x.x:5000/api/sms` (your local IP)

5. **Set Request Method to "POST"**
   - Look for a dropdown that says "GET" or "POST"
   - Select **"POST"**

6. **Configure Request Body Format**
   - Look for "Body Format" or "JSON Format"
   - Select **"JSON"** (if available)
   - Or look for a custom body template field

7. **Set Custom Body (if available)**
   - If the app asks for a custom body format, use:
   ```json
   {
     "from": "%from%",
     "message": "%message%",
     "timestamp": "%time%"
   }
   ```
   
   This tells the app to send:
   - `from` = sender's phone number
   - `message` = the SMS text
   - `timestamp` = when the SMS arrived

8. **Enable the Webhook**
   - Look for a toggle switch that says "Enable" or "Active"
   - Make sure it's **turned ON** (usually green)

9. **Save Settings**
   - Tap **"Save"** or **"Done"**
   - The app should confirm the settings were saved

### 2.3 Optional: Filter Specific Senders

To only forward MoMo notifications (not all SMS):

1. **Find "Filters" or "Sender Filters"**
2. **Add senders you want to forward:**
   - MTN: `+233` or `MTN`
   - Telecel: `+233` or `Telecel`
   - Airtel: `+233` or `Airtel`
3. **Save filters**

---

## Step 3: Test the Connection

### 3.1 Send a Test SMS

1. **Ask a friend to send you a test SMS**
   - Or send yourself a test SMS using another phone
   - Message content: `"Test message for SMS forwarding"`

2. **Watch for the SMS in your phone**
   - You should see it arrive normally

3. **Check if it was forwarded**
   - The app should process it silently in the background
   - You won't see a notification (that's normal)

### 3.2 Verify Backend Received It

1. **Check your backend logs:**
   - If using Render: Go to your Render dashboard → Logs
   - If using Railway: Go to your Railway dashboard → Logs
   - Look for a log entry like:
   ```
   Received SMS: { from: '0556667832', message: 'Test message...', timestamp: '...' }
   ```

2. **If you see the log entry:**
   - ✅ Congratulations! The SMS was forwarded successfully

3. **If you don't see the log entry:**
   - Check your webhook URL is correct
   - Make sure the app is enabled
   - See [Troubleshooting](#troubleshooting) section

---

## Step 4: Verify in Database

### 4.1 Check Database Directly

1. **Access your database:**
   - If using PostgreSQL: Use pgAdmin or DBeaver
   - If using MongoDB: Use MongoDB Compass
   - If using Prisma Studio: Run `npx prisma studio`

2. **Look for the "SmsMessage" table**
   - You should see a table with columns:
     - `id` (auto-increment number)
     - `phoneNumber` (sender's number)
     - `message` (full SMS text)
     - `reference` (transaction ID extracted from message)
     - `amount` (amount extracted from message)
     - `isProcessed` (false = not yet used for top-up)
     - `createdAt` (when SMS was received)

3. **Check if your test SMS is there:**
   - You should see one row with your test message
   - If you don't see it, check the logs in Step 3.2

### 4.2 Example Database Entry

After receiving an MTN MoMo notification, you should see:

| id | phoneNumber | message | reference | amount | isProcessed | createdAt |
|----|-------------|---------|-----------|--------|-------------|-----------|
| 1 | 0556667832 | You have received GHS 50.00 from John. Transaction ID: 1234567890 | 1234567890 | 50.00 | false | 2024-01-15 10:30:45 |

---

## Step 5: Test with Real MoMo Notification

Now that everything is set up, test with a real Mobile Money transaction:

1. **Send yourself a small amount via Mobile Money**
   - Use MTN, Telecel, or Airtel
   - Send GHS 1-5 to your own number
   - You'll receive a notification SMS

2. **Check your database**
   - Go to your database and look for the new SMS
   - You should see:
     - The full notification message
     - The transaction ID extracted
     - The amount extracted

3. **Test the Top-Up Feature**
   - Log into your app as a user
   - Go to "Top Up Wallet"
   - Select "Transaction ID" payment method
   - Enter the transaction ID from the SMS
   - Click "Verify Top-Up"
   - Your wallet should be credited! ✅

---

## Troubleshooting

### Problem: SMS Not Appearing in Database

**Symptom:** I sent an SMS but it's not in the database

**Solutions:**

1. **Check if the app is enabled**
   - Open SMS Forwarder
   - Go to Settings
   - Make sure the webhook toggle is **ON** (green)

2. **Verify the webhook URL is correct**
   - Copy the URL from your backend
   - Paste it into the app settings
   - Make sure there are no typos or extra spaces
   - Make sure it ends with `/api/sms`

3. **Check backend logs for errors**
   - Go to your backend logs (Render/Railway)
   - Look for error messages
   - Common errors:
     - `404 Not Found` = wrong URL path
     - `Connection refused` = backend is down
     - `Invalid JSON` = wrong body format

4. **Test with a simple curl command**
   - Open a terminal/command prompt on your computer
   - Run:
   ```bash
   curl -X POST https://your-backend.com/api/sms \
     -H "Content-Type: application/json" \
     -d '{"from":"0556667832","message":"Test SMS","timestamp":"2024-01-15"}'
   ```
   - If this works, the backend is fine (problem is with the app)
   - If this fails, the backend URL is wrong

5. **Restart the app**
   - Close SMS Forwarder completely
   - Wait 5 seconds
   - Open it again
   - Try sending another SMS

### Problem: App Keeps Stopping or Crashing

**Symptom:** SMS Forwarder crashes or closes unexpectedly

**Solutions:**

1. **Uninstall and reinstall**
   - Go to Settings → Apps → SMS Forwarder
   - Tap "Uninstall"
   - Reinstall from Play Store

2. **Clear app cache**
   - Go to Settings → Apps → SMS Forwarder
   - Tap "Storage" → "Clear Cache"
   - Don't clear data (this will reset settings)

3. **Check phone storage**
   - Go to Settings → Storage
   - Make sure you have at least 500MB free space
   - Delete old files if needed

### Problem: Permission Denied Errors

**Symptom:** App says "Permission denied" or "Cannot read messages"

**Solutions:**

1. **Grant permissions manually**
   - Go to Settings → Apps → SMS Forwarder
   - Tap "Permissions"
   - Enable:
     - ✅ Read SMS
     - ✅ Read Contacts
     - ✅ Access Storage

2. **Reset app permissions**
   - Go to Settings → Apps → SMS Forwarder
   - Tap "Permissions"
   - Disable all permissions
   - Close the app
   - Open the app again
   - Grant permissions when prompted

### Problem: Backend URL Not Accepting Requests

**Symptom:** I get "Connection refused" or "Cannot reach server"

**Solutions:**

1. **Check if backend is running**
   - Go to your backend dashboard (Render/Railway)
   - Look for a green "Running" status
   - If it's not running, click "Deploy" or "Start"

2. **Verify the URL is public**
   - Open the URL in your phone's browser
   - You should see a response (even if it's an error page)
   - If the page doesn't load, the URL is wrong

3. **Check CORS settings**
   - Your backend might be blocking requests from the app
   - Ask your developer to add CORS headers:
   ```javascript
   app.use(cors({
     origin: "*"  // Allow all origins
   }));
   ```

4. **Use HTTP instead of HTTPS (for testing only)**
   - If using a local backend, try:
   ```
   http://192.168.x.x:5000/api/sms
   ```
   - Replace `192.168.x.x` with your computer's local IP
   - Find your IP: On Windows, run `ipconfig` in command prompt

### Problem: SMS Forwarded But Amount/Reference Not Extracted

**Symptom:** SMS is in database but `amount` and `reference` are NULL

**Solutions:**

1. **Check SMS format**
   - The SMS must contain:
     - Amount like: `GHS 50.00` or `GHS 50`
     - Transaction ID like: `Transaction ID: 1234567890`
   - If your bank uses a different format, the parser won't extract it

2. **Update the parser**
   - Ask your developer to update the regex patterns in:
   - `tsk5_backend/services/smsService.js` (lines 29-36)
   - Add your bank's SMS format

3. **Example SMS formats that work:**
   - ✅ "You have received GHS 50.00 from John. Transaction ID: 1234567890"
   - ✅ "Payment received for GHS 100.00. Ref: ABC123456"
   - ❌ "You got 50 cedis" (no "GHS" keyword)
   - ❌ "Txn: ABC123" (no "Transaction ID" keyword)

---

## How It Works (Technical Overview)

If you want to understand what's happening behind the scenes:

### Data Flow

```
Phone receives SMS
        ↓
SMS Forwarder app intercepts it
        ↓
App sends HTTP POST to backend
        ↓
Backend receives request at /api/sms
        ↓
Backend parses SMS (extracts amount, transaction ID)
        ↓
Backend saves to database
        ↓
User enters transaction ID in app
        ↓
Backend searches database for matching SMS
        ↓
If found → Credit user's wallet
        ↓
Mark SMS as processed (prevent reuse)
```

### What Gets Sent to Backend

When an SMS arrives, the app sends:

```json
{
  "from": "0556667832",
  "message": "You have received GHS 50.00 from John. Transaction ID: 1234567890",
  "timestamp": "2024-01-15 10:30:45"
}
```

### What Backend Does

1. **Receives the POST request** at `/api/sms`
2. **Extracts the phone number** from `from` field
3. **Parses the message** using regex to find:
   - Amount (looks for "GHS X.XX")
   - Transaction ID (looks for "Transaction ID: XXXXX")
4. **Saves to database:**
   ```sql
   INSERT INTO SmsMessage (phoneNumber, message, reference, amount, isProcessed)
   VALUES ('0556667832', 'You have received...', '1234567890', 50.00, false)
   ```
5. **Returns success response** to the app

### What User Sees

1. User receives SMS notification (normal)
2. User opens app → Top Up Wallet → Transaction ID
3. User enters transaction ID from SMS
4. App calls backend to verify
5. Backend searches database for matching transaction ID
6. If found → Wallet is credited
7. SMS is marked as processed (can't be used again)

---

## FAQ

### Q: Will this drain my phone battery?

**A:** No. SMS Forwarder runs in the background and uses minimal battery. It only activates when an SMS arrives.

### Q: Will this work offline?

**A:** No. The app needs internet (WiFi or mobile data) to send SMS to your backend. If offline, it will queue the SMS and send when connection is restored.

### Q: Can I use this on iPhone?

**A:** Limited support. iPhone doesn't allow third-party apps to intercept SMS. You would need a different solution (like using an Android phone as a relay).

### Q: What if I receive multiple SMS from the same sender?

**A:** Each SMS is saved separately with its own transaction ID. Users can only use each transaction ID once (the database prevents reuse).

### Q: Can I forward SMS to multiple backends?

**A:** Yes. Some SMS Forwarder versions allow multiple webhooks. Check the app settings for "Multiple Endpoints" or "Backup URL".

### Q: What if my backend goes down?

**A:** The SMS won't be saved. When the backend comes back online, new SMS will be forwarded normally. Old SMS won't be retried automatically.

### Q: How long does it take for SMS to appear in database?

**A:** Usually 1-3 seconds. If it takes longer, check your internet connection.

### Q: Can I delete SMS from the database?

**A:** Yes, but only if they haven't been used for top-ups. Once a user verifies a top-up with a transaction ID, that SMS is marked as processed and shouldn't be deleted.

---

## Next Steps

Once SMS forwarding is working:

1. **Test the full flow:**
   - Send yourself a small MoMo amount
   - Verify the SMS appears in database
   - Use the transaction ID to top up your wallet
   - Confirm wallet balance increases

2. **Tell your users:**
   - They can now use "Transaction ID" payment method
   - They just need to enter the transaction ID from their SMS

3. **Monitor the database:**
   - Regularly check for new SMS entries
   - Make sure amounts are being extracted correctly
   - Delete old processed SMS if needed

4. **Set up alerts (optional):**
   - Ask your developer to send you alerts when SMS forwarding fails
   - This helps catch issues early

---

## Support

If you get stuck:

1. **Check the Troubleshooting section** above
2. **Review your backend logs** (Render/Railway dashboard)
3. **Test with curl command** to verify backend is working
4. **Ask your developer** to check the `/api/sms` endpoint

---

## Summary

✅ Install SMS Forwarder app  
✅ Configure webhook URL to your backend  
✅ Grant permissions to read SMS  
✅ Test with a real SMS  
✅ Verify SMS appears in database  
✅ Users can now top up using transaction IDs  

You're done! 🎉
