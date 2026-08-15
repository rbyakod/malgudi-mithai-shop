// apps/android/app/src/main/java/com/mishran/app/data/local/entity/StoryEntity.kt — P2 net-new (stories).
//
// Offline cache row for a journal story, mirroring the generated `Story`
// contract (id/slug/title/pillar/excerpt/heroImage/publishedAt/updatedAt) with
// the same two adaptations the products cache makes:
//   - the `pillar` enum is stored as its JSON *value* string ("karigar"),
//     keeping rows human-readable and stable across codegen renames;
//   - `heroImage` is resolved to an absolute URL at the repository boundary.
//
// The extra `body` column is the reader's offline fallback: the LIST endpoint
// never returns it (left null on list upserts) while the /stories/{slug} fetch
// writes it, so an open reader renders cached paragraphs when the detail call
// fails offline. Trade-off, documented in StoryRepository: a later list sync
// REPLACES rows without a body, evicting a previously cached one — acceptable
// because the reader always prefers a fresh fetch and only reads the column on
// failure (it then degrades to title + excerpt).
package com.mishran.app.data.local.entity

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "stories")
data class StoryEntity(
    @PrimaryKey val id: String,
    val slug: String,
    val title: String,
    /** JSON value of the Story.Pillar enum ("farm", "karigar", …). */
    val pillar: String,
    val excerpt: String? = null,
    /** Absolute hero URL (resolveMediaUrl applied) — drives the list hero card. */
    val heroImage: String? = null,
    val publishedAt: String? = null,
    val updatedAt: String? = null,
    /** Flattened reader body, cached only by the /stories/{slug} fetch. */
    val body: String? = null,
    /** Epoch millis after which this row is considered stale. See deleteStale(). */
    val staleAt: Long = 0L,
)
