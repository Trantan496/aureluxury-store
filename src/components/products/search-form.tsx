export function SearchForm({ query = "" }: { query?: string }) {
  return <form action="/products" method="get" className="search-form"><label htmlFor="product-query">Tên sản phẩm hoặc từ khóa</label><div><input id="product-query" name="q" type="search" defaultValue={query} placeholder="Bạn đang tìm điều gì?" maxLength={100}/><button className="button" type="submit">Tìm kiếm <span aria-hidden="true">↗</span></button></div></form>;
}
