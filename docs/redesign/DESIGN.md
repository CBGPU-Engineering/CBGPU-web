# CBGPU 2.0 design system

This design applies to the preview app mounted under `/new/`. The base is the
deployed PR 52 commit `5222f4652390223f28408150fe3dd6d07aa6343e`.

The student home starts with today's date, a search field and four daily tasks.
The school directory, projects, contests and community use clear text hierarchy
and rows so school names and long descriptions have room. The desktop home has a
second column for school discovery. Mobile presents the same task priorities in
one column and keeps five destinations in a thumb-reachable dock.

| Role | Light | Dark |
| --- | --- | --- |
| Canvas | `#f4f8fc` | `#0e1927` |
| Surface | `#ffffff` | `#132235` |
| Raised surface | `#f0f6fc` | `#1c3048` |
| Primary text | `#142c45` | `#edf5ff` |
| Secondary text | `#4e637c` | `#b1c5db` |
| Action | `#0758cb` | `#96c4ff` |
| Selection surface | `#e3efff` | `#223e5e` |
| Divider | `#dbe5ef` | `#32485f` |
| Positive | `#176345` | `#82d9ab` |
| Warning | `#815218` | `#f2c481` |
| Error | `#a12545` | `#ffa4b5` |

The source of truth is `preview/app/preview.css`. Its tokens include glass,
the masthead's two ambient layers, focus, elevation, duration and easing. Use
glass for the dock, search and the desktop photo caption. Use a divider to group
dense rows and a surface change to mark a distinct task. The dock is at layer 5
and the keyboard skip link is at layer 10.

Pretendard Variable serves Korean and English with a system fallback. Body text
is 16 px at 1.55 line height. Use compact 14 px metadata. Dates use tabular
figures and explicit Seoul time. Heading weights range from 700 to 760.
Page gutters are 19 px on phones and 24 px elsewhere. Controls use a 13 px
radius unless the search or dock needs a continuous capsule. Sections with
media and grouped lists use 22 px corners.

The dock switches to a rail at 768 px, the rail widens above 950 px, and the
school photo sits beside the masthead from 1180 px. Interactive areas are at
least 44 px in both navigation modes. A focus ring follows the keyboard and
the full search field highlights when it contains focus. Layout allows Korean
word boundaries and wraps exceptionally long tokens.

Use the shared preview search, notice, list, heading and navigation components.
Lucide carries navigation and actions with consistent stroke. Four original
SVGs give daily school tasks a recognizable shape. The Motion navigation
indicator follows selection in the same persistent layout. Press feedback uses
125 ms transform transitions. Reduced motion removes travel and transitions.
Future charts should reserve blue for current values, muted neutral for
comparison, green for healthy and amber/red for explicitly labelled states.

The library photograph on the home is an illustration of a study setting.
It is [Tuyen Vo's Unsplash photo](https://unsplash.com/photos/library-tables-and-chairs-7o7DqXJArf4),
served as a local WebP under the [Unsplash License](https://unsplash.com/license).
The CBGPU wordmark and font are existing repository assets. Public contest
covers use the existing opaque banner URL. Project images are shown only when
a later approved public asset contract provides them.
