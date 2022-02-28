# Scripts

Various set of utils to improve Strava pages.


## ZbynekStravaSegmentInfo

The script enhances Strava segment finder (*Don't see the segment you're looking for?*) with additional information such as speed, grade, time and distance. Also shows the link to the segment. There is new button on the left side - **Info Segments**. When pressing, it adds the above information to segment list.

It enhances the activity page too - options are available under segment list. It adds elevation gain, best effort power, level and type markers.

Additionally, it enhances main segment page by adding more data like elevation gain, level and type markers, protection note and allows easily exporting segment basic information.

The *activity* page and *segment you're looking for* page additionally contain filters at the bottom of the screen - the JS Filter enables filtering by provided JS function, Batch Update allows updating segment preferences based on similar JS function.

JS Filter example:
```js
// This includes only up to level 6 (Extreme), non-gravel and non-mtb routes and not yet known segments listed:
(preference, segment) =>
	preference.protect == null &&
	preference.level <= 6 &&
	preference.type != 'gravel' && preference.type != 'mtb' &&
	`https://www.strava.com/segments/10589705
	more-segments-url-to-be-excluded...
	`.indexOf(String(segment.info.id)+"\n") < 0
```

Batch Update example:
```js
// Anything above 280 W for 20 minutes, 300 W for 10 minutes is categorized as L7 or higher:
(preference, segment) => {
	if (preference.level != null && !isNaN(preference.level))
		return null;
	console.log(preference, segment.best);
	if (segment.best.power >= 280 && segment.best.time >= 1200) {
		return { level: 7+Math.floor((segment.best.power-280)/50) };
	}
	if (segment.best.power >= 300 && segment.best.time >= 600) {
		return { level: 7+Math.floor((segment.best.power-300)/50) };
	}
	if (segment.best.power >= 650 && segment.best.time >= 60) {
		return { level: 7+Math.floor((segment.best.power-650)/100) };
	}
	return null;
}
```

[Link](ZbynekStravaSegmentInfo/ZbynekStravaSegmentInfo.js)


## ZbynekStravaStats

This enhances Strava profile activities view by showing stats only for the particular activity.

At the top of the screen (right above the calendar selection), you can choose activity type and at the right, the activity distance, time and elevation will be shown for the selected period.

[Link](ZbynekStravaStats/ZbynekStravaStats.user.js)


## ZbynekStravaFilterClubUnwanted

GreaseMonkey script, filtering out unexpected members from club recent activities.

There is new action at the right of each activity - **Filter out**. This removes the athlete from the club feed and any of his activities too, even after refreshing the screen.

At the top in list of tabs, there is new submenu - **Unwanted members**. This allows refreshing or resetting back to original stage.

[Link](ZbynekStravaFilterClubUnwanted/ZbynekStravaFilterClubUnwanted.js)


# Donate

Support future development by [donating](https://www.paypal.com/cgi-bin/webscr?cmd=_donations&business=J778VRUGJRZRG&item_name=Support+features+development.&currency_code=CAD&source=url).


# License

The code is released under version 2.0 of the [Apache License][], Apache-2.0 .


# Stay in Touch

Feel free to contact me at kvr000@gmail.com or https://github.com/kvr000/ , https://github.com/kvr000/zbynek-strava-util/

[Apache License]: http://www.apache.org/licenses/LICENSE-2.0
