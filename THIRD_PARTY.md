# Third-party assets

## U.S. state boundaries

`lib/us-states.json` contains simplified SVG paths derived from the Albers-projected
`states-albers-10m.json` dataset in [us-atlas 3.0.1](https://github.com/topojson/us-atlas).
The source is [U.S. Census Bureau cartographic boundary data](https://www.census.gov/geographies/mapping-files/time-series/geo/carto-boundary-file.html).
Paths are simplified to a tolerance of 0.55 projected units and rounded to one decimal
place. Alaska and Hawaii use the source dataset's inset projection.

Source dataset: https://cdn.jsdelivr.net/npm/us-atlas@3.0.1/states-albers-10m.json

### us-atlas license

Copyright 2013-2019 Michael Bostock

Permission to use, copy, modify, and/or distribute this software for any purpose
with or without fee is hereby granted, provided that the above copyright notice
and this permission notice appear in all copies.

THE SOFTWARE IS PROVIDED "AS IS" AND THE AUTHOR DISCLAIMS ALL WARRANTIES WITH
REGARD TO THIS SOFTWARE INCLUDING ALL IMPLIED WARRANTIES OF MERCHANTABILITY AND
FITNESS. IN NO EVENT SHALL THE AUTHOR BE LIABLE FOR ANY SPECIAL, DIRECT,
INDIRECT, OR CONSEQUENTIAL DAMAGES OR ANY DAMAGES WHATSOEVER RESULTING FROM LOSS
OF USE, DATA OR PROFITS, WHETHER IN AN ACTION OF CONTRACT, NEGLIGENCE OR OTHER
TORTIOUS ACTION, ARISING OUT OF OR IN CONNECTION WITH THE USE OR PERFORMANCE OF
THIS SOFTWARE.
