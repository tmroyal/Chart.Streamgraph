# Chart.Streamgraph.js

**This library is no longer being maintained**.

Thank you to anyone who has expressed interest in this project. It was an early attempt by myself to create a javascript library, but life happened (as it has a tendency to do) immediately after I released this. I have since been far away from the javascript ecosystem (and programming in general), and therefore I no longer (10/9/2019) even have the qualifications to evaluate pull requests. Perhaps one day...

Thank you to all who attempted to contribute to this project, and sorry for not being able to integrate your pull requests.

Streamgraph library and plug-in using Chart.js.

This plug-in uses [chart.js](http://chartjs.org) to enable the creation of [Streamgraphs](http://leebyron.com/streamgraph/). Invented by [Lee Byron](http://leebyron.com) and [Martin Wattenberg](http://www.bewitched.com/), Streamgraphs are similar to stacked area charts with the exception that data regions do not overlap. Rather, Streamgraph regions are placed on top of one another, creating a shape that highlights the aggregate sum of all data points. While Streamgraphs do not present data with utmost clarity, they can be a cool way to present time-evolving data sets (for example).

## Documentation

Documentation is available [here](http://tmroyal.github.io/Chart.Streamgraph/).

## Installation

### Bower

`bower install Chart.Streamgraph.js`

### NPM

`npm install chart.streamgraph.js`

### Github

The built distributions are also available in the dst folder in 
the source repository at [Github](https://github.com/tmroyal/Chart.Streamgraph).

## Usage

For the standalone version, which requires no dependencies:

```
<script src="dst/Chart.Streamgraph.S.js"></script>
```

For the plug-in, which requires Chart.js

```
<script src="Chart.js"></script>
<script src="dst/Chart.Streamgraph.js"></script>
```

## License

[MIT license](http://opensource.org/licenses/MIT)

