'use client';
import { useState } from 'react';
import axios from 'axios';

interface TickerData {
  '1. open': string;
  '2. high': string;
  '3. low': string;
  '4. close': string;
  '5. volume': string;
}

interface RiskMetrics {
  dailyVolatility: number;
  annualVolatility: number;
  yesterdayDrawdown: number;
  maxDrawdown: number;
  dailySharpe: number;
  annualSharpe: number;
  beta: number;
  var: number;
  cvar: number;
}

const riskFreeRate = 3.9;
const ALPHA_API = 'IFE2GI7MZGLWK4DK';
// const FRED_API = 'd0a1c8b03b5ee3e9fe43a673e284f9af';
// const POLYGON_API = 'I7ce2x6ny4Xw4u7AkV47xyLqjcKZfvdz';
// const NEWS_API = 'e7c3b74f47454fecbf5ff56606bd920e';

export default function Home() {
  const [ticker, setTicker] = useState('');
  const [tickerData, setTickerData] = useState<TickerData[]>([]);
  const [marketData, setMarketData] = useState<TickerData[]>([]);
  const [riskMetrics, setRiskMetrics] = useState<RiskMetrics>();

  const handleTickerSearch = async () => {
    const tickerUrl = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&outputsize=full&symbol=${ticker}&apikey=${ALPHA_API}`;
    const tickerResponse = await axios.get(tickerUrl);
    const tickerData: TickerData[] = tickerResponse.data['Time Series (Daily)'];
    const oneYearTickerEntries = Object.entries(tickerData).slice(0, 252);
    const oneYearTickerObject = Object.fromEntries(oneYearTickerEntries);
    setTickerData(oneYearTickerObject);

    // if (marketData.length === 0) {
    const marketUrl = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&outputsize=full&symbol=VTI&apikey=${ALPHA_API}`;
    const marketResponse = await axios.get(marketUrl);
    const marketData: TickerData[] = marketResponse.data['Time Series (Daily)'];
    const oneYearMarketEntries = Object.entries(marketData).slice(0, 252);
    const oneYearMarketObject = Object.fromEntries(oneYearMarketEntries);
    setMarketData(oneYearMarketObject);
    // }

    getRiskFreeRate();
    getRiskMetrics(oneYearTickerObject, oneYearMarketObject);
  };

  const getRiskFreeRate = async () => {
    // const url = `https://api.stlouisfed.org/fred/series?series_id=DGS3MO&api_key=${FRED_API}`;
    // const response = await axios.get(url);
    // console.log(response);
  };

  const getRiskMetrics = (tickerData, marketData) => {
    const dailyRiskFreeRate = (1 + riskFreeRate / 100) ** (1 / 252) - 1;
    const returns: number[] = [];
    const marketReturns: number[] = [];
    const drawdowns = [];
    let peak = 0;
    let lastKey = '';
    const alpha = 0.95;
    console.log(tickerData[tickerData.length - 1]);

    for (const key in tickerData) {
      if (lastKey === '') {
        lastKey = key;
        peak = tickerData[key]['4. close'];
      } else {
        const r =
          (+tickerData[key]['4. close'] - +tickerData[lastKey]['4. close']) /
          +tickerData[lastKey]['4. close'];
        returns.push(r);

        const yesterdayClose = +tickerData[key]['4. close'];

        if (yesterdayClose > peak) {
          peak = yesterdayClose;
          drawdowns.push(0);
        } else {
          const d = (+tickerData[key]['4. close'] - peak) / peak;
          drawdowns.push(d);
        }
      }
      lastKey = key;
    }

    lastKey = '';

    for (const key in marketData) {
      if (lastKey === '') {
        lastKey = key;
      } else {
        const r =
          (+marketData[key]['4. close'] - +marketData[lastKey]['4. close']) /
          +marketData[lastKey]['4. close'];
        marketReturns.push(r);
      }
      lastKey = key;
    }

    const average = returns.reduce((a, b) => a + b, 0) / returns.length;
    const marketAverage =
      marketReturns.reduce((a, b) => a + b, 0) / marketReturns.length;
    const variance =
      returns.reduce((sum, r) => sum + Math.pow(r - average, 2), 0) /
      (returns.length - 1);
    const marketVariance =
      marketReturns.reduce(
        (sum, r) => sum + Math.pow(r - marketAverage, 2),
        0
      ) /
      (marketReturns.length - 1);
    const stdDev = Math.sqrt(variance) * 100;
    const covariance =
      returns.reduce(
        (sum, x, i) => sum + (x - average) * (marketReturns[i] - marketAverage),
        0
      ) /
      (returns.length - 1);
    const sortedReturns = returns.sort((a, b) => a - b);
    const index = Math.floor((1 - alpha) * sortedReturns.length);
    const VaR = -sortedReturns[index] * tickerData[tickerData.length - 1]; // need to multiply by the current price of the stock
    const conditionalLoss = sortedReturns.slice(0, index);
    const averageConditionalLoss =
      (conditionalLoss.reduce((a, b) => a + b, 0) / conditionalLoss.length) *
      100;

    const risk = {
      dailyVolatility: parseFloat(stdDev.toFixed(2)),
      annualVolatility: parseFloat((stdDev * Math.sqrt(252)).toFixed(2)),
      yesterdayDrawdown: parseFloat(
        (drawdowns[drawdowns.length - 1] * 100).toFixed(1)
      ),
      maxDrawdown: +Math.min(...drawdowns).toFixed(1),
      dailySharpe: parseFloat(
        ((average - dailyRiskFreeRate) / stdDev).toFixed(4)
      ),
      annualSharpe: parseFloat(
        (((average - dailyRiskFreeRate) / stdDev) * Math.sqrt(252)).toFixed(4)
      ),
      beta: parseFloat((covariance / marketVariance).toFixed(4)),
      var: parseFloat(VaR.toFixed(2)),
      cvar: parseFloat(averageConditionalLoss.toFixed(2)),
    };

    setRiskMetrics(risk);
  };

  return (
    <main>
      <section>
        <input
          value={ticker}
          onChange={(e) => setTicker(e.target.value)}
          placeholder="Search for Ticker"
        ></input>
        <button onClick={handleTickerSearch}>Search</button>
      </section>
      {/* {riskMetrics && ( */}
        <div>
          <table className='riskTable'>
            <thead>
              <tr>
                <th colSpan={2}>Risk Metrics</th>
              </tr>
              <tr>
                <th>Ticker Symbol</th>
                <th>{ticker}</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Daily Volatility</td>
                <td>{riskMetrics?.dailyVolatility + '%' || 'N/A'}</td>
              </tr>
              <tr>
                <td>Annual Volatility</td>
                <td>{riskMetrics?.annualVolatility + '%' || 'N/A'}</td>
              </tr>
              <tr>
                <td>Yesterday Drawdown</td>
                <td>{riskMetrics?.yesterdayDrawdown + '%' || 'N/A'}</td>
              </tr>
              <tr>
                <td>Max Drawdown</td>
                <td>{riskMetrics?.maxDrawdown + '%' || 'N/A'}</td>
              </tr>
              <tr>
                <td>Daily Sharpe Ratio</td>
                <td>{riskMetrics?.dailySharpe || 'N/A'}</td>
              </tr>
              <tr>
                <td>Annual Sharpe Ratio</td>
                <td>{riskMetrics?.annualSharpe || 'N/A'}</td>
              </tr>
              <tr>
                <td>Beta</td>
                <td>{riskMetrics?.beta || 'N/A'}</td>
              </tr>
              <tr>
                <td>VaR (95%)</td>
                <td>{riskMetrics?.var || 'N/A'}</td>
              </tr>
              <tr>
                <td>Conditional VaR</td>
                <td>{riskMetrics?.var + '%' || 'N/A'}</td>
              </tr>
              <tr>
                <td>Correlation</td>
                <td></td>
              </tr>
              <tr>
                <td>Covariance</td>
                <td></td>
              </tr>
              <tr>
                <td>Sortino Ratio</td>
                <td></td>
              </tr>
              <tr>
                <td>Turnover Ratio</td>
                <td></td>
              </tr>
            </tbody>
          </table>
        </div>
      {/* )} */}
      {tickerData && (
        <div>
          <table className='ticker'>
            <thead>
              <tr>
                <th>Date</th>
                <th>Open</th>
                <th>High</th>
                <th>Low</th>
                <th>Close</th>
                <th>Volume</th>
              </tr>
            </thead>
            <tbody className='historical'>
              {Object.entries(tickerData).map(([date, values], index) => (
                <tr key={index}>
                  <td>{date}</td>
                  <td>{(+values['1. open']).toFixed(2)}</td>
                  <td>{(+values['2. high']).toFixed(2)}</td>
                  <td>{(+values['3. low']).toFixed(2)}</td>
                  <td>{(+values['4. close']).toFixed(2)}</td>
                  <td>{(+values['5. volume']).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </main>
  );
}

// useEffect(() => {
// async function fetchAllTickers() {
//   const url = `https://api.polygon.io/v3/reference/tickers?market=stocks&active=true&order=asc&limit=1000&sort=ticker&exchange=XNYS&apiKey=${POLYGON_API}`;
//   const response = await axios.get(url);
//   console.log(response.data);
//   setAllTickers(response.data.results);
// }
// fetchAllTickers();
//   async function fetchNews() {
//     const yesterday = new Date(Date.now() - 3 * 24 * 60 * 60 * 1000)
//       .toISOString()
//       .split('T')[0];
//     const searchTerm = encodeURI('Stock Market');
//     const url = `https://newsapi.org/v2/everything?q=${searchTerm}&from=${yesterday}&sortBy=publishedAt&language=en&apiKey=${NEWS_API}`;
//     const url = `https://serpapi.com/search.json?engine=google_finance&q=LAC`;
//     const response = await axios.get(url);
//     console.log(response.data);
//   }

//   if (allTickers.length> 0) {
//     const news = fetchNews();
//   }
// }, [allTickers]);
