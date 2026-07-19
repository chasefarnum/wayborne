# explore-map (delta)

## ADDED Requirements

### Requirement: Route mode changes what the map says, not what it is
When a route is active, the map SHALL render the rider's line as a single LineString with marked endpoints, a visible ~5-mile corridor treatment containing the line, in-corridor pins at full strength, and out-of-corridor content dimmed. Clearing the route SHALL restore the catalog map exactly. Base layers, pin categories, and card behavior SHALL be unchanged by route mode.

#### Scenario: Route active on the map
- **WHEN** a rider's line is set
- **THEN** the line, endpoints, and corridor render, in-corridor pins show full strength, and everything outside the corridor dims

#### Scenario: Route cleared from the map
- **WHEN** the rider clears the route
- **THEN** the map returns to the catalog presentation with all published content at full strength

### Requirement: Route-mode motion earns its complexity
The routed line SHALL draw in over roughly 400ms after routing resolves, the corridor SHALL appear after the line completes, and filter changes SHALL update list and pins in one beat. Under reduced motion, all of these SHALL be instant swaps with no loss of information.

#### Scenario: Reduced motion preference set
- **WHEN** a rider with prefers-reduced-motion sets a route
- **THEN** line, corridor, and results appear instantly with no animation
