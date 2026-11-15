// =============================================================================
// CARBON CURRENTS · geography: cities (searchable, labelled on the map),
// named regions (dashed boxes) and country outlines (loaded from public/data).
// =============================================================================
import { feature } from 'topojson-client';
import { geoBounds, geoCentroid } from 'd3-geo';

export async function loadCountries(url = '/data/co2/world-countries.topo.json') {
  const world = await (await fetch(url)).json();
  const countries = feature(world, world.objects.countries).features.filter(f => f.properties && f.properties.name);
  countries.forEach(f => { f.bbox2 = geoBounds(f); f.centroid = geoCentroid(f); });
  return countries;
}

// [name, country, lon, lat] — order = importance (labels appear by rank as you zoom in)
export const CITIES = [
  ['Tokyo','Japan',139.69,35.69],['Delhi','India',77.21,28.61],['Shanghai','China',121.47,31.23],['São Paulo','Brazil',-46.63,-23.55],['Mexico City','Mexico',-99.13,19.43],
  ['Cairo','Egypt',31.24,30.04],['Mumbai','India',72.88,19.08],['Beijing','China',116.41,39.9],['Dhaka','Bangladesh',90.41,23.81],['Osaka','Japan',135.5,34.69],
  ['New York','United States',-74.01,40.71],['Karachi','Pakistan',67.01,24.86],['Buenos Aires','Argentina',-58.38,-34.6],['Chongqing','China',106.55,29.56],['Istanbul','Turkey',28.98,41.01],
  ['Kolkata','India',88.36,22.57],['Manila','Philippines',120.98,14.6],['Lagos','Nigeria',3.38,6.52],['Rio de Janeiro','Brazil',-43.17,-22.91],['Tianjin','China',117.2,39.13],
  ['Kinshasa','DR Congo',15.27,-4.44],['Guangzhou','China',113.26,23.13],['Los Angeles','United States',-118.24,34.05],['Moscow','Russia',37.62,55.76],['Shenzhen','China',114.06,22.54],
  ['Lahore','Pakistan',74.36,31.52],['Bangalore','India',77.59,12.97],['Paris','France',2.35,48.86],['Bogotá','Colombia',-74.07,4.71],['Jakarta','Indonesia',106.85,-6.21],
  ['Chennai','India',80.27,13.08],['Lima','Peru',-77.04,-12.05],['Bangkok','Thailand',100.5,13.76],['Seoul','South Korea',126.98,37.57],['Hyderabad','India',78.49,17.39],
  ['London','United Kingdom',-0.13,51.51],['Tehran','Iran',51.39,35.69],['Chicago','United States',-87.63,41.88],['Chengdu','China',104.07,30.57],['Wuhan','China',114.31,30.59],
  ['Ho Chi Minh City','Vietnam',106.63,10.82],['Luanda','Angola',13.23,-8.84],['Ahmedabad','India',72.57,23.02],['Kuala Lumpur','Malaysia',101.69,3.14],["Xi'an",'China',108.94,34.34],
  ['Hong Kong','China',114.17,22.32],['Hangzhou','China',120.16,30.27],['Riyadh','Saudi Arabia',46.68,24.71],['Baghdad','Iraq',44.36,33.31],['Santiago','Chile',-70.67,-33.45],
  ['Madrid','Spain',-3.7,40.42],['Pune','India',73.86,18.52],['Houston','United States',-95.37,29.76],['Dallas','United States',-96.8,32.78],['Toronto','Canada',-79.38,43.65],
  ['Dar es Salaam','Tanzania',39.21,-6.79],['Miami','United States',-80.19,25.76],['Singapore','Singapore',103.82,1.35],['Philadelphia','United States',-75.17,39.95],['Atlanta','United States',-84.39,33.75],
  ['Khartoum','Sudan',32.56,15.5],['Barcelona','Spain',2.17,41.39],['Johannesburg','South Africa',28.05,-26.2],['Saint Petersburg','Russia',30.34,59.93],['Washington, D.C.','United States',-77.04,38.91],
  ['Yangon','Myanmar',96.2,16.87],['Guadalajara','Mexico',-103.35,20.66],['Abidjan',"Côte d'Ivoire",-4.01,5.36],['Ankara','Turkey',32.86,39.93],['Melbourne','Australia',144.96,-37.81],
  ['Sydney','Australia',151.21,-33.87],['Monterrey','Mexico',-100.32,25.69],['Nairobi','Kenya',36.82,-1.29],['Hanoi','Vietnam',105.85,21.03],['Cape Town','South Africa',18.42,-33.92],
  ['Berlin','Germany',13.4,52.52],['Rome','Italy',12.5,41.9],['Milan','Italy',9.19,45.46],['Casablanca','Morocco',-7.59,33.57],['Kabul','Afghanistan',69.21,34.56],
  ['Addis Ababa','Ethiopia',38.75,9.03],['Accra','Ghana',-0.19,5.6],['Dubai','United Arab Emirates',55.27,25.2],['Doha','Qatar',51.53,25.29],['Taipei','Taiwan',121.56,25.03],
  ['Phoenix','United States',-112.07,33.45],['San Francisco','United States',-122.42,37.77],['Seattle','United States',-122.33,47.61],['Denver','United States',-104.99,39.74],['Boston','United States',-71.06,42.36],
  ['Montreal','Canada',-73.57,45.5],['Vancouver','Canada',-123.12,49.28],['Havana','Cuba',-82.37,23.11],['Caracas','Venezuela',-66.9,10.49],['Quito','Ecuador',-78.47,-0.18],
  ['Brasília','Brazil',-47.88,-15.79],['Manaus','Brazil',-60.02,-3.12],['Auckland','New Zealand',174.76,-36.85],['Perth','Australia',115.86,-31.95],['Darwin','Australia',130.84,-12.46],
  ['Reykjavík','Iceland',-21.94,64.15],['Oslo','Norway',10.75,59.91],['Stockholm','Sweden',18.07,59.33],['Warsaw','Poland',21.01,52.23],['Kyiv','Ukraine',30.52,50.45],
  ['Athens','Greece',23.73,37.98],['Vienna','Austria',16.37,48.21],['Amsterdam','Netherlands',4.9,52.37],['Brussels','Belgium',4.35,50.85],['Lisbon','Portugal',-9.14,38.72],
  ['Dublin','Ireland',-6.26,53.35],['Anchorage','United States',-149.9,61.22],['Honolulu','United States',-157.86,21.31],['Ulaanbaatar','Mongolia',106.91,47.89],['Almaty','Kazakhstan',76.89,43.24],
  ['Tashkent','Uzbekistan',69.24,41.31],['Novosibirsk','Russia',82.92,55.03],['Vladivostok','Russia',131.89,43.12],['Colombo','Sri Lanka',79.86,6.93],['Kathmandu','Nepal',85.32,27.72],
  ['Islamabad','Pakistan',73.05,33.68],['Phnom Penh','Cambodia',104.92,11.56],['Vientiane','Laos',102.63,17.97],['Chiang Mai','Thailand',98.98,18.79],['Kano','Nigeria',8.52,12.0],
  ['Dakar','Senegal',-17.47,14.72],['Bamako','Mali',-8.0,12.64],["N'Djamena",'Chad',15.04,12.13],['Kampala','Uganda',32.58,0.35],['Harare','Zimbabwe',31.05,-17.83],
  ['Antananarivo','Madagascar',47.52,-18.88],['Fukuoka','Japan',130.4,33.59],['Qingdao','China',120.38,36.07],['Nanjing','China',118.8,32.06],['Surat','India',72.83,21.17]
].map(function (c, i) { return { name: c[0], country: c[1], lon: c[2], lat: c[3], rank: i }; });

export const REGIONS = [
  { name: 'Eastern United States', box: [-95, 25, -66, 48] }, { name: 'Western United States', box: [-125, 30, -100, 50] },
  { name: 'Europe', box: [-11, 35, 35, 62] }, { name: 'East Asia', box: [100, 20, 146, 50] }, { name: 'South Asia', box: [64, 5, 95, 36] },
  { name: 'Sahel fire belt', box: [-18, 2, 36, 18] }, { name: 'Southeast Asia', box: [90, -10, 126, 26] }, { name: 'Amazon', box: [-76, -16, -44, 5] },
  { name: 'Middle East', box: [34, 14, 62, 40] }, { name: 'Southern Africa', box: [12, -35, 41, -15] }
];
