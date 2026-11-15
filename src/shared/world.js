// Country outlines (Natural Earth via topojson), shared by every map exhibit.
import { feature } from 'topojson-client';
import { geoBounds, geoCentroid } from 'd3-geo';

let cache = null;
export function loadCountries(url = '/data/world/countries.topo.json') {
  cache ||= fetch(url).then(r => r.json()).then(world => {
    const countries = feature(world, world.objects.countries).features.filter(f => f.properties && f.properties.name);
    countries.forEach(f => { f.bbox2 = geoBounds(f); f.centroid = geoCentroid(f); });
    return countries;
  });
  return cache;
}
