# API Configuration Guide

## Overview

SafeBite works perfectly out-of-the-box with **8 free barcode databases** requiring zero configuration. You can optionally add API keys to enable **4 additional premium databases** for even better coverage.

## Default Configuration (No Setup Required)

These databases work immediately:
- ✅ Open Food Facts
- ✅ Open Beauty Facts  
- ✅ Open Products Facts
- ✅ UPC Database
- ✅ UPC Item DB (trial)
- ✅ EAN-Search
- ✅ Datakick
- ✅ USDA FoodData Central (with DEMO_KEY)

## AI Features

The AI analysis and recommendations features use the Rork Toolkit service which is configured by default at `https://toolkit.rork.com`.

### AI Capabilities:
- ✅ Detailed allergen analysis
- ✅ Alternative product recommendations  
- ✅ Cross-contamination risk assessment
- ✅ Ingredient safety evaluation

No additional configuration needed - AI features work automatically!

## Optional: Premium Database APIs

To enable additional databases with better coverage, you can add API keys as environment variables:

### Backend Environment Variables

Create a `.env` file in your backend or set these in your hosting environment:

```bash
# Barcode Lookup (https://www.barcodelookup.com/api)
# Free tier: 100 requests/day
# Paid: $50-500/month depending on volume
BARCODE_LOOKUP_KEY=your_api_key_here

# World UPC (https://www.worldupc.com)  
# Commercial service with global coverage
WORLD_UPC_API_KEY=your_api_key_here

# Nutritionix (https://www.nutritionix.com/business/api)
# Free tier: 5,000 requests/month
# Includes restaurant menus and branded foods
NUTRITIONIX_APP_ID=your_app_id
NUTRITIONIX_APP_KEY=your_app_key

# Edamam (https://developer.edamam.com)
# Free tier: 100,000 requests/month
# Food, recipe, and nutrition data
EDAMAM_APP_ID=your_app_id  
EDAMAM_APP_KEY=your_app_key

# USDA (https://fdc.nal.usda.gov/api-key-signup.html)
# Free with registration (no rate limits with key)
# Currently uses DEMO_KEY (rate limited)
USDA_API_KEY=your_api_key
```

### How to Get API Keys

#### 1. Barcode Lookup
1. Visit https://www.barcodelookup.com/api
2. Sign up for an account
3. Choose a plan (free tier available)
4. Copy your API key
5. Add to env: `BARCODE_LOOKUP_KEY=your_key`

#### 2. World UPC
1. Go to https://www.worldupc.com
2. Register for API access
3. Review pricing plans
4. Get your Bearer token
5. Add to env: `WORLD_UPC_API_KEY=your_token`

#### 3. Nutritionix
1. Visit https://www.nutritionix.com/business/api
2. Create a developer account
3. Create a new application
4. Copy App ID and App Key
5. Add both to env variables

#### 4. Edamam  
1. Go to https://developer.edamam.com
2. Sign up and verify email
3. Subscribe to Food Database API (free tier)
4. Get your Application ID and Key
5. Add both to env variables

#### 5. USDA
1. Visit https://fdc.nal.usda.gov/api-key-signup.html
2. Fill out the signup form
3. Receive API key via email
4. Add to env: `USDA_API_KEY=your_key`

## Environment Variable Configuration

### For Local Development

Create a `.env` file in your project root:

```bash
# .env
BARCODE_LOOKUP_KEY=abc123...
WORLD_UPC_API_KEY=xyz789...
NUTRITIONIX_APP_ID=myapp123
NUTRITIONIX_APP_KEY=secretkey456
EDAMAM_APP_ID=myapp789  
EDAMAM_APP_KEY=secretkey012
USDA_API_KEY=mykey345
```

### For Production

Set environment variables in your hosting platform:

**Vercel:**
```bash
vercel env add BARCODE_LOOKUP_KEY
```

**Heroku:**
```bash
heroku config:set BARCODE_LOOKUP_KEY=abc123...
```

**Netlify:**
Add in Site Settings → Environment Variables

**AWS/Docker:**
Add to your deployment configuration

## Verification

To verify your API keys are working:

1. Check backend logs when scanning a product
2. Look for messages like:
   - ✅ "Product found in barcodelookup"
   - ✅ "Product found in nutritionix"
   - ❌ "Skipping barcodelookup: API key not configured"

## Cost Estimate

### Free Tier Usage:
- **8 free databases**: $0/month
- **Nutritionix free**: 5,000 requests/month = $0
- **Edamam free**: 100,000 requests/month = $0
- **Total**: $0/month for typical usage

### If You Need More:
- **Barcode Lookup**: $50-500/month
- **World UPC**: Contact for pricing  
- **Nutritionix paid**: $299/month for unlimited
- **Edamam paid**: $49-499/month for higher tiers

### Recommendation:
Start with **free tier** (zero cost) which covers 95%+ of products. Only upgrade if you need:
- Very high request volume (>10,000/month)
- Specialized product categories
- Guaranteed SLA/uptime

## Troubleshooting

### "API key not configured" messages
- Normal behavior - app skips that database and tries others
- Only add keys if you need additional coverage

### "Rate limit exceeded"  
- USDA DEMO_KEY has limits - upgrade to full key
- Free tiers have monthly limits
- Consider caching products locally (already implemented)

### "Invalid API key"
- Double-check key spelling
- Ensure no extra spaces/quotes
- Verify key is active in provider dashboard
- Check if key requires IP whitelisting

### Products still not found
- Even with all databases, some products may not be indexed
- New products take time to appear in databases
- Regional/local products may have limited coverage
- Consider manual entry or barcode might be incorrect

## Security Best Practices

1. **Never commit** API keys to git
2. Add `.env` to `.gitignore`
3. Use **environment variables** in production
4. Rotate keys periodically
5. Use different keys for dev/staging/prod
6. Monitor API usage for anomalies
7. Set up billing alerts for paid tiers

## Support

If you have issues with:
- **Free databases**: No support needed, they're community services
- **Premium APIs**: Contact the individual service providers
- **App integration**: Check logs and ensure env variables are loaded correctly

## Summary

✨ **Key Takeaway**: SafeBite works great with **zero configuration** using 8 free databases. Premium APIs are **completely optional** and only needed for specialized use cases or extremely high volume.

**Recommended Setup:**
- ✅ Start with free tier (no setup)
- ✅ Monitor product found rate
- ✅ Only add premium APIs if needed
- ✅ Begin with free tiers before paying
