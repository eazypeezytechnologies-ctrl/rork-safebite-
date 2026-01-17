import { RecallSearchResponse } from '@/types';
import { safeFetch } from '@/utils/safeFetch';

const FDA_API = 'https://api.fda.gov/food/enforcement.json';

export async function searchRecalls(query: string): Promise<RecallSearchResponse> {
  console.log('Searching recalls for:', query);
  
  try {
    const searchTerms = query
      .split(/\s+/)
      .filter(term => term.length > 2)
      .map(term => `product_description:"${term}"`)
      .join('+OR+');
    
    if (!searchTerms) {
      return { results: [], meta: { results: { total: 0 } } };
    }

    const url = `${FDA_API}?search=${searchTerms}&limit=20`;
    console.log('FDA API URL:', url);
    
    const data = await safeFetch(url, {
      headers: {
        'Accept': 'application/json',
      },
    });
    console.log(`Found ${data.results?.length || 0} recalls`);
    
    return {
      results: data.results || [],
      meta: data.meta || { results: { total: 0 } },
    };
  } catch (error) {
    console.warn('Error searching recalls (service may be unavailable):', error instanceof Error ? error.message : 'Unknown error');
    return { results: [], meta: { results: { total: 0 } } };
  }
}

export async function searchRecallsByBarcode(barcode: string): Promise<RecallSearchResponse> {
  console.log('Searching recalls by barcode:', barcode);
  
  try {
    const url = `${FDA_API}?search=product_description:"${barcode}"&limit=20`;
    const data = await safeFetch(url, {
      headers: {
        'Accept': 'application/json',
      },
    });
    
    return {
      results: data.results || [],
      meta: data.meta || { results: { total: 0 } },
    };
  } catch (error) {
    console.warn('Error searching recalls by barcode (service may be unavailable):', error instanceof Error ? error.message : 'Unknown error');
    return { results: [], meta: { results: { total: 0 } } };
  }
}
