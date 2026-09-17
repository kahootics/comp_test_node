
## Hash Router

```php
+ lastNonRouteHash: hash (string)
+ static build(
        documentOriginalTitle: string,
        routesMap: Map<string,string>,
        routerOptions?: HashRouterOptions
    ): HashRouter
+ instance: HashRouter

HashRouterEvent extends HashChangeEvent implements HashRouterEventInit
+ reset?: boolean;
+ route?: route;
+ title?: title;

class HashRouterRequestEvent extends Event implements HashRouterRequestEventInit 
+ newRoute?: route;
+ reset?: boolean;
+ terminate?: boolean;

```

```
?BaseArticle:
    creates anchor to hash route, appends it to itself
    the route it calls is stored in fullPage prop
    auto registers itself in class register
```