// apps/android/app/src/main/java/com/mishran/app/data/repository/EnquiryRepository.kt — P2 net-new (enquiry).
//
// Thin wrapper over the PUBLIC POST /api/leads intake (wedding + corporate).
// No caching, no DataStore — a one-shot command whose success payload
// (leadId + ops message) is rendered directly by the enquiry screen. Failures
// propagate as exceptions so the ViewModel can surface "try again" without
// distinguishing causes (the endpoint has no partial states).
package com.mishran.app.data.repository

import com.mishran.app.data.remote.api.LeadCreatedResponse
import com.mishran.app.data.remote.api.LeadSubmissionRequest
import com.mishran.app.data.remote.api.MishranApi
import java.io.IOException
import javax.inject.Inject
import javax.inject.Singleton

@Singleton
class EnquiryRepository @Inject constructor(
    private val api: MishranApi,
) {

    /**
     * Submit a lead. Returns the server's [LeadCreatedResponse] (leadId shown
     * on the success state); throws on any transport/HTTP failure.
     */
    suspend fun submit(request: LeadSubmissionRequest): LeadCreatedResponse {
        val response = api.submitLead(request)
        // The route is outside the generated contract; a body without a leadId
        // means something unexpected answered — treat it as a failed submit.
        return response.takeIf { !it.leadId.isNullOrBlank() }
            ?: throw IOException("Lead submission returned no leadId")
    }
}
