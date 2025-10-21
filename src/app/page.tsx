'use client';
import { useState } from 'react';
import axios from 'axios';

interface TickerData {
  date: string;
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
  correlation: number;
  covariance: number;
  dailySortino: number;
  annualSortino: number;
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
    const oneYearTickerArray: TickerData[] = oneYearTickerEntries.map(
      ([date, data]) => {
        return {
          '1. open': data['1. open'],
          '2. high': data['2. high'],
          '3. low': data['3. low'],
          '4. close': data['4. close'],
          '5. volume': data['5. volume'],
          date, // your date from the key
        };
      }
    );
    setTickerData(oneYearTickerArray);

    // if (marketData.length === 0) {
    const marketUrl = `https://www.alphavantage.co/query?function=TIME_SERIES_DAILY&outputsize=full&symbol=VTI&apikey=${ALPHA_API}`;
    const marketResponse = await axios.get(marketUrl);
    const marketData: TickerData[] = marketResponse.data['Time Series (Daily)'];
    const oneYearMarketEntries = Object.entries(marketData).slice(0, 252);
    const oneYearMarketArray: TickerData[] = oneYearMarketEntries.map(
      ([date, data]) => {
        return {
          '1. open': data['1. open'],
          '2. high': data['2. high'],
          '3. low': data['3. low'],
          '4. close': data['4. close'],
          '5. volume': data['5. volume'],
          date, // your date from the key
        };
      }
    );
    setMarketData(oneYearMarketArray);
    // }

    getRiskFreeRate();
    getRiskMetrics(oneYearTickerArray, oneYearMarketArray);
  };

  const getRiskFreeRate = async () => {
    // const url = `https://api.stlouisfed.org/fred/series?series_id=DGS3MO&api_key=${FRED_API}`;
    // const response = await axios.get(url);
    // console.log(response);
  };

  const getRiskMetrics = (
    tickerData: TickerData[],
    marketData: TickerData[]
  ) => {
    const dailyRiskFreeRate = (1 + riskFreeRate / 100) ** (1 / 252) - 1;
    const returns: number[] = [];
    const marketReturns: number[] = [];
    const drawdowns: number[] = [];
    let peak = 0;
    const alpha = 0.95;

    tickerData.forEach((day, i) => {
      if (i === 0) {
        peak = +day['4. close'];
      } else {
        const r =
          (+day['4. close'] - +tickerData[i - 1]['4. close']) /
          +tickerData[i - 1]['4. close'];
        returns.push(r);
      }
      const yesterdayClose = +day['4. close'];

      if (yesterdayClose > peak) {
        peak = yesterdayClose;
        drawdowns.push(0);
      } else {
        const d = (+day['4. close'] - peak) / peak;
        drawdowns.push(d);
      }
    });

    marketData.forEach((day, i) => {
      if (i === 0) {
        return;
      } else {
        const r =
          (+day['4. close'] - +marketData[i - 1]['4. close']) /
          +marketData[i - 1]['4. close'];
        marketReturns.push(r);
      }
    });

    const negativeReturns = returns.filter((r) => r < 0);
    const average = returns.reduce((a, b) => a + b, 0) / returns.length;
    const marketAverage =
      marketReturns.reduce((a, b) => a + b, 0) / marketReturns.length;
    const variance =
      returns.reduce((sum, r) => sum + Math.pow(r - average, 2), 0) /
      (returns.length - 1);
    const negativeVariance =
      negativeReturns.reduce((sum, r) => sum + Math.pow(r, 2), 0) /
      returns.length;
    const marketVariance =
      marketReturns.reduce(
        (sum, r) => sum + Math.pow(r - marketAverage, 2),
        0
      ) /
      (marketReturns.length - 1);
    const stdDev = Math.sqrt(variance) * 100;
    const negativeStdDev = Math.sqrt(negativeVariance) * 100;
    const marketStdDev = Math.sqrt(marketVariance) * 100;
    const covariance =
      returns.reduce(
        (sum, x, i) => sum + (x - average) * (marketReturns[i] - marketAverage),
        0
      ) /
      (returns.length - 1);
    const sortedReturns = returns.sort((a, b) => a - b);
    const index = Math.floor((1 - alpha) * sortedReturns.length);
    const VaR = -sortedReturns[index] * 100;
    const conditionalLoss = sortedReturns.slice(0, index);
    const averageConditionalLoss =
      -(conditionalLoss.reduce((a, b) => a + b, 0) / conditionalLoss.length) *
      100;

    const risk = {
      dailyVolatility: parseFloat(stdDev.toFixed(2)),
      annualVolatility: parseFloat((stdDev * Math.sqrt(252)).toFixed(2)),
      yesterdayDrawdown: parseFloat(
        (drawdowns[drawdowns.length - 1] * 100).toFixed(1)
      ),
      maxDrawdown: parseFloat((+Math.min(...drawdowns) * 100).toFixed(1)),
      dailySharpe: parseFloat(
        ((average - dailyRiskFreeRate) / stdDev).toFixed(4)
      ),
      annualSharpe: parseFloat(
        (((average - dailyRiskFreeRate) / stdDev) * Math.sqrt(252)).toFixed(4)
      ),
      beta: parseFloat((covariance / marketVariance).toFixed(4)),
      var: parseFloat(VaR.toFixed(2)),
      cvar: parseFloat(averageConditionalLoss.toFixed(2)),
      correlation: parseFloat(
        (+covariance / (+stdDev / (100 * +marketStdDev))).toFixed(4)
      ),
      covariance: parseFloat(covariance.toFixed(4)),
      dailySortino: parseFloat(
        ((average - dailyRiskFreeRate) / negativeStdDev).toFixed(4)
      ),
      annualSortino: parseFloat(
        (
          ((average - dailyRiskFreeRate) / negativeStdDev) *
          Math.sqrt(252)
        ).toFixed(4)
      ),
    };

    setRiskMetrics(risk);
    console.log(risk);
  };

  return (
    <main>
      <section className={riskMetrics ? 'top' : 'centered'}>
        <input
          value={ticker}
          onChange={(e) => setTicker(e.target.value)}
          placeholder="Search for Ticker"
        ></input>
        <button onClick={handleTickerSearch}>Search</button>
      </section>
      {riskMetrics && (
        <div>
          <table className="riskTable">
            <thead className="sticky-header">
              <tr>
                <th colSpan={3}>Risk Metrics</th>
              </tr>
              <tr>
                <th>Ticker Symbol</th>
                <th>{ticker}</th>
                <th>Meaning</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td>Daily Volatility</td>
                <td>{riskMetrics?.dailyVolatility + '%' || 'N/A'}</td>
                <td
                  className={
                    riskMetrics?.dailyVolatility < 1
                      ? 'low'
                      : riskMetrics?.dailyVolatility > 2
                      ? 'high'
                      : ''
                  }
                >
                  {riskMetrics?.dailyVolatility < 0.3
                    ? 'Very Low Risk'
                    : riskMetrics?.dailyVolatility < 1
                    ? 'Low Risk'
                    : riskMetrics?.dailyVolatility < 2
                    ? 'Moderate Risk'
                    : riskMetrics?.dailyVolatility < 4
                    ? 'High Risk'
                    : 'Very High Risk'}
                </td>
              </tr>
              <tr>
                <td>Annual Volatility</td>
                <td>{riskMetrics?.annualVolatility + '%' || 'N/A'}</td>
                <td
                  className={
                    riskMetrics?.annualVolatility < 1
                      ? 'low'
                      : riskMetrics?.annualVolatility > 2
                      ? 'high'
                      : ''
                  }
                >
                  {riskMetrics?.annualVolatility < 5
                    ? 'Very Low Risk'
                    : riskMetrics?.annualVolatility < 15
                    ? 'Low Risk'
                    : riskMetrics?.annualVolatility < 25
                    ? 'Moderate Risk'
                    : riskMetrics?.annualVolatility < 40
                    ? 'High Risk'
                    : 'Very High Risk'}
                </td>
              </tr>
              <tr>
                <td>Yesterday Drawdown</td>
                <td>{riskMetrics?.yesterdayDrawdown + '%' || 'N/A'}</td>
                <td
                  className={
                    riskMetrics?.yesterdayDrawdown > -10
                      ? 'low'
                      : riskMetrics?.yesterdayDrawdown < -20
                      ? 'high'
                      : ''
                  }
                >
                  {riskMetrics?.yesterdayDrawdown > -5
                    ? 'Stable'
                    : riskMetrics?.yesterdayDrawdown > -10
                    ? 'Mild Correction'
                    : riskMetrics?.yesterdayDrawdown > -20
                    ? 'Normal Pullback'
                    : riskMetrics?.yesterdayDrawdown > -40
                    ? 'High Volatility'
                    : riskMetrics?.yesterdayDrawdown > -60
                    ? 'Severe Bull Market'
                    : 'Catastrophic'}
                </td>
              </tr>
              <tr>
                <td>Max Drawdown</td>
                <td>{riskMetrics?.maxDrawdown + '%' || 'N/A'}</td>
                <td
                  className={
                    riskMetrics?.maxDrawdown > -10
                      ? 'low'
                      : riskMetrics?.maxDrawdown < -20
                      ? 'high'
                      : ''
                  }
                >
                  {riskMetrics?.maxDrawdown > -5
                    ? 'Stable'
                    : riskMetrics?.maxDrawdown > -10
                    ? 'Mild Correction'
                    : riskMetrics?.maxDrawdown > -20
                    ? 'Normal Pullback'
                    : riskMetrics?.maxDrawdown > -40
                    ? 'High Volatility'
                    : riskMetrics?.maxDrawdown > -60
                    ? 'Severe Bull Market'
                    : 'Catastrophic'}
                </td>
              </tr>
              <tr>
                <td>Daily Sharpe Ratio</td>
                <td>{riskMetrics?.dailySharpe || 'N/A'}</td>
                <td
                  className={
                    riskMetrics?.dailySharpe < 1
                      ? 'low'
                      : riskMetrics?.dailySharpe > 2
                      ? 'high'
                      : ''
                  }
                >
                  {riskMetrics?.dailySharpe < 0
                    ? 'Poor'
                    : riskMetrics?.dailySharpe < 1
                    ? 'Low'
                    : riskMetrics?.dailySharpe < 2
                    ? 'Good'
                    : riskMetrics?.dailySharpe < 3
                    ? 'Very Good'
                    : 'Excellent'}
                </td>
              </tr>
              <tr>
                <td>Annual Sharpe Ratio</td>
                <td>{riskMetrics?.annualSharpe || 'N/A'}</td>
                <td
                  className={
                    riskMetrics?.annualSharpe < 1
                      ? 'low'
                      : riskMetrics?.annualSharpe > 2
                      ? 'high'
                      : ''
                  }
                >
                  {riskMetrics?.annualSharpe < 0
                    ? 'Poor'
                    : riskMetrics?.annualSharpe < 1
                    ? 'Low'
                    : riskMetrics?.annualSharpe < 2
                    ? 'Good'
                    : riskMetrics?.annualSharpe < 3
                    ? 'Very Good'
                    : 'Excellent'}
                </td>
              </tr>
              <tr>
                <td>Beta</td>
                <td>{riskMetrics?.beta || 'N/A'}</td>
                <td
                  className={
                    riskMetrics?.beta < 0.5
                      ? 'low'
                      : riskMetrics?.beta > 1
                      ? 'high'
                      : ''
                  }
                >
                  {riskMetrics?.beta < 0
                    ? 'Inverse Risk'
                    : riskMetrics?.beta < 0.5
                    ? 'Low Risk'
                    : riskMetrics?.beta < 1
                    ? 'Moderate Risk'
                    : riskMetrics?.beta < 1.5
                    ? 'High Risk'
                    : 'Very High Risk'}
                </td>
              </tr>
              <tr>
                <td>95% VaR (per Share)</td>
                <td>
                  {riskMetrics?.var +
                    '% ($' +
                    (
                      (riskMetrics?.var *
                        +tickerData[tickerData.length - 1]['4. close']) /
                      100
                    ).toFixed(2) +
                    ')' || 'N/A'}
                </td>
                <td
                  className={
                    riskMetrics?.var < 1.5
                      ? 'low'
                      : riskMetrics?.var > 3
                      ? 'high'
                      : ''
                  }
                >
                  {riskMetrics?.var < 1.5
                    ? 'Low Risk'
                    : riskMetrics?.var < 3
                    ? 'Moderate Risk'
                    : riskMetrics?.var < 6
                    ? 'High Risk'
                    : 'Very High Risk'}
                </td>
              </tr>
              <tr>
                <td>Conditional VaR</td>
                <td>{riskMetrics?.cvar + '%' || 'N/A'}</td>
                <td
                  className={
                    riskMetrics?.cvar < 1.5
                      ? 'low'
                      : riskMetrics?.cvar > 3
                      ? 'high'
                      : ''
                  }
                >
                  {riskMetrics?.cvar < 1.5
                    ? 'Low Risk'
                    : riskMetrics?.cvar < 3
                    ? 'Moderate Risk'
                    : riskMetrics?.cvar < 5
                    ? 'High Risk'
                    : 'Very High Risk'}
                </td>
              </tr>
              <tr>
                <td>Correlation</td>
                <td>{riskMetrics?.correlation || 'N/A'}</td>
                <td
                  className={
                    riskMetrics?.correlation < 0
                      ? 'high'
                      : riskMetrics?.correlation > 0
                      ? 'low'
                      : ''
                  }
                >
                  {riskMetrics?.correlation < -0.5
                    ? 'Strong Inverse'
                    : riskMetrics?.correlation < -0.1
                    ? 'Weak Inverse'
                    : riskMetrics?.correlation > 0.5
                    ? 'Strong Direct'
                    : riskMetrics?.correlation > 0.1
                    ? 'Weak Direct'
                    : 'No Correlation'}
                </td>
              </tr>
              <tr>
                <td>Daily Sortino Ratio</td>
                <td>{riskMetrics?.dailySortino || 'N/A'}</td>
                <td
                  className={
                    riskMetrics?.dailySortino < 1
                      ? 'high'
                      : riskMetrics?.dailySortino > 2
                      ? 'low'
                      : ''
                  }
                >
                  {riskMetrics?.dailySortino < 0
                    ? 'Poor'
                    : riskMetrics?.dailySortino < 1
                    ? 'Low'
                    : riskMetrics?.dailySortino < 2
                    ? 'Good'
                    : riskMetrics?.dailySortino < 3
                    ? 'Very Good'
                    : 'Excellent'}
                </td>
              </tr>
              <tr>
                <td>Annual Sortino Ratio</td>
                <td>{riskMetrics?.annualSortino || 'N/A'}</td>
                <td
                  className={
                    riskMetrics?.annualSortino < 1
                      ? 'high'
                      : riskMetrics?.annualSortino > 2
                      ? 'low'
                      : ''
                  }
                >
                  {riskMetrics?.annualSortino < 0
                    ? 'Poor'
                    : riskMetrics?.annualSortino < 1
                    ? 'Low'
                    : riskMetrics?.annualSortino < 2
                    ? 'Good'
                    : riskMetrics?.annualSortino < 3
                    ? 'Very Good'
                    : 'Excellent'}
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
      {riskMetrics && (
        <div>
          <table className="ticker">
            <thead className="sticky-header">
              <tr>
                <th>Date</th>
                <th>Open</th>
                <th>High</th>
                <th>Low</th>
                <th>Close</th>
                <th>Volume</th>
              </tr>
            </thead>
            <tbody className="historical">
              {tickerData.map((d, index) => (
                <tr key={index}>
                  <td>{d.date}</td>
                  <td>{(+d['1. open']).toFixed(2)}</td>
                  <td>{(+d['2. high']).toFixed(2)}</td>
                  <td>{(+d['3. low']).toFixed(2)}</td>
                  <td>{(+d['4. close']).toFixed(2)}</td>
                  <td>{(+d['5. volume']).toFixed(2)}</td>
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
