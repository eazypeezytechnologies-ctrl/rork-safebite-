import { Database, DBProduct } from '@/storage/database';
import { SupabaseService, supabaseAdmin } from '@/backend/services/supabaseService';

const OFF_API = 'https://world.openfoodfacts.org/api/v2';
const OBF_API = 'https://world.openbeautyfacts.org/api/v2';
const OPF_API = 'https://world.openproductsfacts.org/api/v2';
const UPC_DATABASE_API = 'https://api.upcdatabase.org/product';
const BARCODE_LOOKUP_API = 'https://api.barcodelookup.com/v3/products';
const EAN_SEARCH_API = 'https://ean-search.org/api';
const USDA_API = 'https://api.nal.usda.gov/fdc/v1';
const NUTRITIONIX_API = 'https://trackapi.nutritionix.com/v2';
const EDAMAM_API = 'https://api.edamam.com/api/food-database/v2';
const UPC_ITEM_DB_API = 'https://api.upcitemdb.com/prod/trial/lookup';
const WORLD_UPC_API = 'https://api.worldupc.com/api/v2';
const DATAKICK_API = 'https://www.datakick.org/api/items';

const CACHE_EXPIRY_MS = 7 * 24 * 60 * 60 * 1000;

export class ProductService {
  static async getProductByBarcode(barcode: string, forceRefresh: boolean = false): Promise<DBProduct | null> {
    let cached: DBProduct | null = null;
    
    try {
      const supabaseCached = await SupabaseService.getProduct(barcode);
      if (supabaseCached) {
        cached = {
          code: supabaseCached.code,
          product_name: supabaseCached.product_name || '',
          brands: supabaseCached.brands,
          image_url: supabaseCached.image_url,
          image_front_url: supabaseCached.image_front_url,
          ingredients_text: supabaseCached.ingredients_text,
          allergens: supabaseCached.allergens,
          allergens_tags: supabaseCached.allergens_tags,
          traces: supabaseCached.traces,
          traces_tags: supabaseCached.traces_tags,
          categories: supabaseCached.categories,
          categories_tags: supabaseCached.categories_tags,
          source: supabaseCached.source as any,
          cachedAt: supabaseCached.cached_at,
          lastFetchedAt: supabaseCached.last_fetched_at,
          scanCount: supabaseCached.scan_count,
        };
      }
    } catch (error) {
      console.error('[ProductService] Error fetching from Supabase:', error);
    }

    if (!forceRefresh && cached) {
      const age = Date.now() - new Date(cached.lastFetchedAt).getTime();
      if (age < CACHE_EXPIRY_MS) {
        console.log('Returning cached product:', barcode);
        await SupabaseService.incrementScanCount(barcode).catch(e => console.error('Error incrementing scan count:', e));
        return cached;
      }
    }

    const sources = [
      { api: OFF_API, source: 'openfoodfacts' as const, type: 'openx' },
      { api: OBF_API, source: 'openbeautyfacts' as const, type: 'openx' },
      { api: OPF_API, source: 'openproductsfacts' as const, type: 'openx' },
      { api: UPC_DATABASE_API, source: 'upcdatabase' as const, type: 'upc' },
      { api: UPC_ITEM_DB_API, source: 'upcitemdb' as const, type: 'upcitemdb' },
      { api: BARCODE_LOOKUP_API, source: 'barcodelookup' as const, type: 'barcodelookup' },
      { api: WORLD_UPC_API, source: 'worldupc' as const, type: 'worldupc' },
      { api: EAN_SEARCH_API, source: 'eansearch' as const, type: 'eansearch' },
      { api: DATAKICK_API, source: 'datakick' as const, type: 'datakick' },
      { api: USDA_API, source: 'usda' as const, type: 'usda' },
      { api: NUTRITIONIX_API, source: 'nutritionix' as const, type: 'nutritionix' },
      { api: EDAMAM_API, source: 'edamam' as const, type: 'edamam' },
    ];

    for (const { api, source, type } of sources) {
      try {
        let data: any = null;
        let productData: any = null;

        switch (type) {
          case 'openx':
            const openxResponse = await fetch(`${api}/product/${barcode}.json`);
            data = await openxResponse.json();
            if (data.status === 1 && data.product) {
              productData = data.product;
            }
            break;

          case 'upc':
            const upcResponse = await fetch(`${api}/${barcode}`, {
              headers: {
                'Accept': 'application/json',
              }
            });
            data = await upcResponse.json();
            if (data.success && data.product) {
              productData = {
                code: barcode,
                product_name: data.product.title || data.product.description,
                brands: data.product.brand,
                image_url: data.product.image,
                image_front_url: data.product.image,
                ingredients_text: data.product.ingredients || '',
                allergens: data.product.allergens || '',
                allergens_tags: [],
                traces: '',
                traces_tags: [],
                categories: data.product.category,
                categories_tags: data.product.category ? [data.product.category] : [],
              };
            }
            break;

          case 'barcodelookup':
            if (!process.env.BARCODE_LOOKUP_KEY) {
              console.log('Skipping barcodelookup: API key not configured');
              continue;
            }
            const barcodeResponse = await fetch(`${api}?barcode=${barcode}&formatted=y&key=${process.env.BARCODE_LOOKUP_KEY}`);
            if (!barcodeResponse.ok) {
              console.log(`barcodelookup returned ${barcodeResponse.status}`);
              continue;
            }
            const barcodeText = await barcodeResponse.text();
            if (!barcodeText || barcodeText.trim().length === 0) {
              console.log('barcodelookup returned empty response');
              continue;
            }
            try {
              data = JSON.parse(barcodeText);
            } catch {
              console.log('barcodelookup returned invalid JSON');
              continue;
            }
            if (data.products && data.products.length > 0) {
              const product = data.products[0];
              productData = {
                code: product.barcode_number,
                product_name: product.product_name || product.title,
                brands: product.brand,
                image_url: product.images?.[0],
                image_front_url: product.images?.[0],
                ingredients_text: product.ingredients || '',
                allergens: product.allergens || '',
                allergens_tags: [],
                traces: '',
                traces_tags: [],
                categories: product.category,
                categories_tags: product.category ? [product.category] : [],
              };
            }
            break;

          case 'eansearch':
            const eanResponse = await fetch(`${api}?op=barcode-lookup&barcode=${barcode}&format=json`);
            if (!eanResponse.ok) {
              console.log(`eansearch returned ${eanResponse.status}`);
              continue;
            }
            const eanText = await eanResponse.text();
            if (!eanText || eanText.trim().length === 0) {
              console.log('eansearch returned empty response');
              continue;
            }
            if (eanText.startsWith('<')) {
              console.log('eansearch returned HTML instead of JSON');
              continue;
            }
            try {
              data = JSON.parse(eanText);
            } catch {
              console.log('eansearch returned invalid JSON');
              continue;
            }
            if (Array.isArray(data) && data.length > 0 && data[0].name) {
              productData = {
                code: barcode,
                product_name: data[0].name,
                brands: data[0].company || '',
                image_url: '',
                image_front_url: '',
                ingredients_text: '',
                allergens: '',
                allergens_tags: [],
                traces: '',
                traces_tags: [],
                categories: data[0].category || '',
                categories_tags: data[0].category ? [data[0].category] : [],
              };
            }
            break;

          case 'usda':
            const usdaResponse = await fetch(`${api}/foods/search?query=${barcode}&api_key=${process.env.USDA_API_KEY || 'DEMO_KEY'}`);
            data = await usdaResponse.json();
            if (data.foods && data.foods.length > 0) {
              const food = data.foods[0];
              productData = {
                code: barcode,
                product_name: food.description,
                brands: food.brandOwner || '',
                image_url: '',
                image_front_url: '',
                ingredients_text: food.ingredients || '',
                allergens: '',
                allergens_tags: [],
                traces: '',
                traces_tags: [],
                categories: food.foodCategory || '',
                categories_tags: food.foodCategory ? [food.foodCategory] : [],
              };
            }
            break;

          case 'nutritionix':
            if (!process.env.NUTRITIONIX_APP_ID || !process.env.NUTRITIONIX_APP_KEY) {
              console.log('Skipping nutritionix: API credentials not configured');
              continue;
            }
            const nutritionixResponse = await fetch(`${api}/search/item?upc=${barcode}`, {
              headers: {
                'x-app-id': process.env.NUTRITIONIX_APP_ID,
                'x-app-key': process.env.NUTRITIONIX_APP_KEY,
              }
            });
            data = await nutritionixResponse.json();
            if (data.foods && data.foods.length > 0) {
              const food = data.foods[0];
              productData = {
                code: barcode,
                product_name: food.food_name || food.brand_name,
                brands: food.brand_name || '',
                image_url: food.photo?.thumb || '',
                image_front_url: food.photo?.thumb || '',
                ingredients_text: '',
                allergens: food.allergens ? food.allergens.join(', ') : '',
                allergens_tags: food.allergens || [],
                traces: '',
                traces_tags: [],
                categories: food.tags?.item || '',
                categories_tags: food.tags?.item ? [food.tags.item] : [],
              };
            }
            break;

          case 'edamam':
            if (!process.env.EDAMAM_APP_ID || !process.env.EDAMAM_APP_KEY) {
              console.log('Skipping edamam: API credentials not configured');
              continue;
            }
            const edamamResponse = await fetch(`${api}/parser?upc=${barcode}&app_id=${process.env.EDAMAM_APP_ID}&app_key=${process.env.EDAMAM_APP_KEY}`);
            data = await edamamResponse.json();
            if (data.parsed && data.parsed.length > 0) {
              const food = data.parsed[0].food;
              productData = {
                code: barcode,
                product_name: food.label || food.knownAs,
                brands: food.brand || '',
                image_url: food.image || '',
                image_front_url: food.image || '',
                ingredients_text: '',
                allergens: '',
                allergens_tags: [],
                traces: '',
                traces_tags: [],
                categories: food.category || '',
                categories_tags: food.category ? [food.category] : [],
              };
            }
            break;

          case 'upcitemdb':
            const upcItemResponse = await fetch(`${api}?upc=${barcode}`);
            if (!upcItemResponse.ok) {
              console.log(`upcitemdb returned ${upcItemResponse.status}`);
              continue;
            }
            data = await upcItemResponse.json();
            if (data.items && data.items.length > 0) {
              const item = data.items[0];
              productData = {
                code: barcode,
                product_name: item.title || item.description,
                brands: item.brand || '',
                image_url: item.images?.[0] || '',
                image_front_url: item.images?.[0] || '',
                ingredients_text: '',
                allergens: '',
                allergens_tags: [],
                traces: '',
                traces_tags: [],
                categories: item.category || '',
                categories_tags: item.category ? [item.category] : [],
              };
            }
            break;

          case 'worldupc':
            if (!process.env.WORLD_UPC_API_KEY) {
              console.log('Skipping worldupc: API key not configured');
              continue;
            }
            const worldUpcResponse = await fetch(`${api}/product/${barcode}`, {
              headers: {
                'Authorization': `Bearer ${process.env.WORLD_UPC_API_KEY}`,
              }
            });
            data = await worldUpcResponse.json();
            if (data.product) {
              productData = {
                code: barcode,
                product_name: data.product.name || data.product.title,
                brands: data.product.brand || '',
                image_url: data.product.image || '',
                image_front_url: data.product.image || '',
                ingredients_text: data.product.ingredients || '',
                allergens: data.product.allergens || '',
                allergens_tags: [],
                traces: '',
                traces_tags: [],
                categories: data.product.category || '',
                categories_tags: data.product.category ? [data.product.category] : [],
              };
            }
            break;

          case 'datakick':
            const datakickResponse = await fetch(`${api}/${barcode}`);
            if (!datakickResponse.ok) {
              console.log(`datakick returned ${datakickResponse.status}`);
              continue;
            }
            data = await datakickResponse.json();
            if (data.name) {
              productData = {
                code: barcode,
                product_name: data.name,
                brands: data.brand_name || '',
                image_url: data.images?.[0]?.url || '',
                image_front_url: data.images?.[0]?.url || '',
                ingredients_text: data.ingredients || '',
                allergens: data.allergens || '',
                allergens_tags: [],
                traces: '',
                traces_tags: [],
                categories: data.category || '',
                categories_tags: data.category ? [data.category] : [],
              };
            }
            break;
        }

        if (productData) {
          console.log(`Product found in ${source}:`, productData.product_name);
          
          const product: DBProduct = {
            code: productData.code || barcode,
            product_name: productData.product_name,
            brands: productData.brands,
            image_url: productData.image_url,
            image_front_url: productData.image_front_url,
            ingredients_text: productData.ingredients_text,
            allergens: productData.allergens,
            allergens_tags: productData.allergens_tags,
            traces: productData.traces,
            traces_tags: productData.traces_tags,
            categories: productData.categories,
            categories_tags: productData.categories_tags,
            source,
            cachedAt: cached?.cachedAt || new Date().toISOString(),
            lastFetchedAt: new Date().toISOString(),
            scanCount: (cached?.scanCount || 0) + 1,
          };

          await this.saveProduct(product);
          return product;
        }
      } catch (error) {
        console.error(`Error searching ${source}:`, error);
      }
    }

    console.log('Product not found in any database');
    return null;
  }

  static async searchProducts(query: string, page: number = 1): Promise<{ products: DBProduct[]; count: number; page: number }> {
    try {
      const response = await fetch(
        `${OFF_API}/search?search_terms=${encodeURIComponent(query)}&page=${page}&page_size=20&fields=code,product_name,brands,image_url,image_front_url,ingredients_text,allergens,allergens_tags,traces,traces_tags,categories,categories_tags`
      );
      const data = await response.json();

      const products: DBProduct[] = (data.products || []).map((p: any) => ({
        code: p.code,
        product_name: p.product_name,
        brands: p.brands,
        image_url: p.image_url,
        image_front_url: p.image_front_url,
        ingredients_text: p.ingredients_text,
        allergens: p.allergens,
        allergens_tags: p.allergens_tags,
        traces: p.traces,
        traces_tags: p.traces_tags,
        categories: p.categories,
        categories_tags: p.categories_tags,
        source: 'openfoodfacts' as const,
        cachedAt: new Date().toISOString(),
        lastFetchedAt: new Date().toISOString(),
        scanCount: 0,
      }));

      return {
        products,
        count: data.count || 0,
        page: data.page || 1,
      };
    } catch (error) {
      console.error('Error searching products:', error);
      return { products: [], count: 0, page: 1 };
    }
  }

  static async saveProduct(product: DBProduct): Promise<void> {
    try {
      await SupabaseService.upsertProduct({
        code: product.code,
        product_name: product.product_name,
        brands: product.brands,
        image_url: product.image_url,
        image_front_url: product.image_front_url,
        ingredients_text: product.ingredients_text,
        allergens: product.allergens,
        allergens_tags: product.allergens_tags,
        traces: product.traces,
        traces_tags: product.traces_tags,
        categories: product.categories,
        categories_tags: product.categories_tags,
        source: product.source,
        cached_at: product.cachedAt,
        last_fetched_at: product.lastFetchedAt,
        scan_count: product.scanCount,
      });
      console.log('[ProductService] Product saved to Supabase:', product.code);
    } catch (error) {
      console.error('[ProductService] Error saving product to Supabase:', error);
      const products = await Database.getProducts();
      const index = products.findIndex(p => p.code === product.code);
      if (index >= 0) {
        products[index] = product;
      } else {
        products.push(product);
      }
      await Database.saveProducts(products);
    }
  }

  static async getPopularProducts(limit: number = 10): Promise<DBProduct[]> {
    try {
      if (!supabaseAdmin) {
        console.warn('[ProductService] Supabase not configured, returning empty array');
        return [];
      }

      const { data, error } = await supabaseAdmin
        .from('products')
        .select('*')
        .order('scan_count', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('[ProductService] Error fetching popular products from Supabase:', error);
        return [];
      }

      return (data || []).map((p: any) => ({
        code: p.code,
        product_name: p.product_name,
        brands: p.brands,
        image_url: p.image_url,
        image_front_url: p.image_front_url,
        ingredients_text: p.ingredients_text,
        allergens: p.allergens,
        allergens_tags: p.allergens_tags,
        traces: p.traces,
        traces_tags: p.traces_tags,
        categories: p.categories,
        categories_tags: p.categories_tags,
        source: p.source,
        cachedAt: p.cached_at,
        lastFetchedAt: p.last_fetched_at,
        scanCount: p.scan_count,
      }));
    } catch (error) {
      console.error('[ProductService] Error in getPopularProducts:', error);
      return [];
    }
  }

  static async getRecentProducts(limit: number = 10): Promise<DBProduct[]> {
    try {
      if (!supabaseAdmin) {
        console.warn('[ProductService] Supabase not configured, returning empty array');
        return [];
      }

      const { data, error } = await supabaseAdmin
        .from('products')
        .select('*')
        .order('last_fetched_at', { ascending: false })
        .limit(limit);

      if (error) {
        console.error('[ProductService] Error fetching recent products from Supabase:', error);
        return [];
      }

      return (data || []).map((p: any) => ({
        code: p.code,
        product_name: p.product_name,
        brands: p.brands,
        image_url: p.image_url,
        image_front_url: p.image_front_url,
        ingredients_text: p.ingredients_text,
        allergens: p.allergens,
        allergens_tags: p.allergens_tags,
        traces: p.traces,
        traces_tags: p.traces_tags,
        categories: p.categories,
        categories_tags: p.categories_tags,
        source: p.source,
        cachedAt: p.cached_at,
        lastFetchedAt: p.last_fetched_at,
        scanCount: p.scan_count,
      }));
    } catch (error) {
      console.error('[ProductService] Error in getRecentProducts:', error);
      return [];
    }
  }
}
