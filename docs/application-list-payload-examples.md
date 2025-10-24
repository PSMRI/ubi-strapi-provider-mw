# API Payload Examples for /applications/list

> **Note**: The `status` field accepts an array of valid status values: `["pending", "approved", "rejected", "in_progress", "resubmit"]`
>
> **Note**: The `orderBy` field supports: `["updatedAt", "createdAt", "id"]`

## Example 1: Basic Pagination

```json
{
	"benefitId": "benefit-123",
	"limit": 20,
	"offset": 0
}
```

## Example 2: Pagination with Offset

```json
{
	"benefitId": "benefit-123",
	"limit": 20,
	"offset": 20
}
```

## Example 3: Filter by Status

```json
{
	"benefitId": "benefit-123",
	"status": ["pending", "approved"],
	"limit": 20,
	"offset": 0
}
```

## Example 4: Order by Created At Ascending

```json
{
	"benefitId": "benefit-123",
	"limit": 20,
	"offset": 0,
	"orderBy": "createdAt",
	"orderDirection": "asc"
}
```

## Example 5: Order by Updated At Descending

```json
{
	"benefitId": "benefit-123",
	"limit": 20,
	"offset": 0,
	"orderBy": "updatedAt",
	"orderDirection": "desc"
}
```

## Example 6: Order by ID

```json
{
	"benefitId": "benefit-123",
	"limit": 20,
	"offset": 0,
	"orderBy": "id",
	"orderDirection": "asc"
}
```

## Example 7: Combined Status Filter with Ordering

```json
{
	"benefitId": "benefit-123",
	"status": ["pending", "approved"],
	"limit": 50,
	"offset": 0,
	"orderBy": "updatedAt",
	"orderDirection": "desc"
}
```
