# 优化matchRoute函数逻辑

matchRoute函数实现根据输入的URL在路由表中返回匹配的路由。

## 默认子路由的处理逻辑

当一个路由对象具有children（即具有子路由）时，如果该路由到此路由时，子路由项中满足以上条件的路由项为该路由的默认子路由：

- path为""或"/"或"./"的路由项

如

```
routes: [
        {
            name:"a",
            path: "products",
            view: "pages/products.html",
            children: [
                {
                    name:"a-home",
                    path: "", // 默认路由
                    view: "pages/products-list.html",
                    data: "data/products.json",
                },
                {...},
                {...}
            ]
        },
        ...
    ]
```

当导航到`/products`路由时，会将默认子路由加入到匹配列表中

[KylinMatchedRoute(a),KylinMatchedRoute(a-home)]

- 先渲染`pages/products.html`，内部具有<kylin-outlet>组件
- 然后渲染`pages/products-list.html`到<kylin-outlet>

- 具有default:true的路由项

除了通过path为""或"/"或"./"来指定默认路由外，还可以通过添加一个布尔属性default:true来指定默认子路由：

```
routes: [
        {
            name:"a",
            path: "products",
            view: "pages/products.html",
            children: [
                {
                    path: "a", // 默认路由
                    view: "pages/products-list.html",
                    data: "data/products.json",
                },
                {
                    path: "b",
                    default: true, // 也可以通过default:true来指定默认路由
                    view: "pages/product-detail.html",
                    data: "data/product-detail.json",
                }
            ]
        },
        ...
    ]
```

- 现在的matchRoute函数在进行匹配时会进行全表查询匹配，取消此机制,当匹配到后就马上返回。
- 默认路由支持嵌套，也就是可以有多个层级的默认路由，当匹配到一个路由项后，如果该路由项具有子路由，则继续在子路由中查找默认路由，直到没有默认路由为止。

# 路由不匹配的情况

```
routes: [
        {
            name:"a",
            path: "products",
            view: "pages/products.html",
            children: [
                {
                    path: "a", // 默认路由
                    view: "pages/products-list.html",
                    data: "data/products.json",
                    children: [
                        {
                            path: "b",
                            default: true, // 也可以通过default:true来指定默认路由
                            view: "pages/product-detail.html",
                            data: "data/product-detail.json",
                        }
                    ]
                }

            ]
        },
        ...
    ]
```

以上例为例，当导航到`/products/a/x/y/z`时，在现有的匹配逻辑中会认为没有匹配到路由，因为`/products/a/x/y/z`没有对应的路由项.
现在需要修改逻辑，在采用逐段匹配时，如果在某个层级没有匹配到路由项，则会将未匹配的路由项也会返回

[
KylinMatchedRoute(/products), // 匹配到/products路由项
KylinMatchedRoute(a), // 匹配到/products/a路由项
KylinMatchedRoute(/x/y/z) // 没有匹配，所以此时KylinMatchedRoute.route为undefined
]

这样在渲染时会按以下逻辑渲染#️⃣

- 先渲染`pages/products.html`，内部具有<kylin-outlet>组件
    - 然后渲染`pages/products-list.html`到<kylin-outlet>
        - 最后渲染一个404组件到<kylin-outlet>

由于一般路由表根中会有path="/"代表根路由，所以当导航到一个不存在的路由时，至少会匹配到根路由项，这样就可以先渲染根路由对应的视图，然后在根视图中显示一个404组件，提示用户当前页面不存在。
