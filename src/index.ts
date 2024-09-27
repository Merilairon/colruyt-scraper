import 'dotenv/config'
import axios from 'axios';
import {HttpsProxyAgent} from 'https-proxy-agent';
import {SocksProxyAgent} from 'socks-proxy-agent';
import {Agent} from "node:https";

const tunnelTimeout = 10000; // 10 seconds
/**
 * The main function that executes the program logic.
 */
async function main() {
    try {
        // Retrieve the API key using the getApiKey function.
        let apiKey = await getApiKey(); 
        
        // Fetch product data using the proxiedRequest function.
        // We pass the product URL, API key, and host URL as parameters.
        const responseBody = await proxiedRequest(process.env.PRODUCT_URL, {
            'X-Cg-Apikey': apiKey, // Set the API key in the request header.
            'host': process.env.HOST_URL, // Set the host URL in the request header.
        });
        
        // Log the response body to the console.
        console.log(responseBody); 
    } catch (error) {
        // Handle any errors that occur during execution.
        // Log the error message to the console and exit the process with an error code.
        console.error(`Error: ${error.message}`); 
        process.exit(1); 
    }
}

/**
 * Retrieves the API key.
 *
 * @returns {Promise<string>} A promise that resolves with the API key.
 */
async function getApiKey(): Promise<string> {
  // Make a request to the API URL and extract the headers.
  const {
    changeHomestore: {
      storeLocator: {
        api: { headers },
      },
    },
  } = await proxiedRequest(process.env.API_URL);

  // Extract the API key from the headers.
  // Assumes the API key is in the first header and formatted as "key: value".
  return headers[0].split(": ")[1];
}

/**
 * Sends a proxied request to the specified URL.
 *
 * @param {string} url - The URL to send the request to.
 * @param {any} [headers={}] - The headers to include in the request.
 * @param {any} [params={}] - The query parameters to include in the request.
 * @returns {Promise<any>} A promise that resolves with the response data.
 * @throws {Error} If there is an error sending the request or if the proxy scheme is unsupported.
 */
async function proxiedRequest(url: string, headers: any = {}, params: any = {}): Promise<any> {
    // Get the proxy URL from the environment variables.
    const proxyURL = process.env.PROXY_ENDPOINT;
    
    // Parse the proxy URL.
    const parsedUrl = new URL(proxyURL);

    // Create an agent based on the proxy protocol.
    let agent: Agent;
    if (parsedUrl.protocol.startsWith('http')) {
        // Use HttpsProxyAgent for HTTP proxies.
        agent = new HttpsProxyAgent(proxyURL);
    } else if (parsedUrl.protocol.startsWith('socks')) {
        // Use SocksProxyAgent for SOCKS proxies.
        agent = new SocksProxyAgent(proxyURL);
    } else {
        // Throw an error if the proxy scheme is unsupported.
        throw new Error(`Unsupported proxy scheme: ${parsedUrl.protocol}`);
    }

    try {
        // Send the request using axios.
        const response = await axios.get(url, {
            httpAgent: agent, // Use the created agent for HTTP requests.
            httpsAgent: agent, // Use the created agent for HTTPS requests.
            timeout: tunnelTimeout, // Set the request timeout.
            headers, // Include the specified headers.
            params // Include the specified query parameters.
        });
        // Return the response data.
        return response.data;
    } catch (error) {
        // Throw an error if there is an HTTP error.
        throw new Error(`HTTP error: ${error.response ? error.response.status : error.message}`);
    }
}

//TODO: add more logic for when crashing
main().catch(console.error);