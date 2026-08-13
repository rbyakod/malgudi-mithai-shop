// KeychainHelper.swift — Task 15.4 (Mishran Mobile Apps v1).
// Generic kSecClassGenericPassword wrapper (SecItemAdd/SecItemUpdate/
// SecItemCopyMatching). The token store (KeychainTokenStore in
// Data/Remote/Authenticator.swift) keeps its JSON-pair item; this helper is
// the general-purpose string API for later single-value secrets. Throws on
// unhandled OSStatus so callers can surface real keychain failures instead
// of silent nils.
import Foundation
import Security

struct KeychainHelper {
    enum KeychainError: Error {
        case unhandled(OSStatus)
    }

    /// Store (insert or overwrite) a string under service+key.
    func setString(_ value: String, forKey key: String, service: String) throws {
        try setData(Data(value.utf8), forKey: key, service: service)
    }

    /// Read a string; nil when the item doesn't exist.
    func getString(forKey key: String, service: String) throws -> String? {
        guard let data = try getData(forKey: key, service: service) else { return nil }
        return String(data: data, encoding: .utf8)
    }

    /// Delete the item; no-op (no error) when absent.
    func removeString(forKey key: String, service: String) throws {
        let status = SecItemDelete(baseQuery(key: key, service: service) as CFDictionary)
        guard status == errSecSuccess || status == errSecItemNotFound else {
            throw KeychainError.unhandled(status)
        }
    }

    // MARK: - Data-level primitives

    func setData(_ data: Data, forKey key: String, service: String) throws {
        var query = baseQuery(key: key, service: service)
        let update: [String: Any] = [kSecValueData as String: data]
        let updateStatus = SecItemUpdate(query as CFDictionary, update as CFDictionary)
        if updateStatus == errSecItemNotFound {
            query[kSecValueData as String] = data
            let addStatus = SecItemAdd(query as CFDictionary, nil)
            guard addStatus == errSecSuccess else {
                throw KeychainError.unhandled(addStatus)
            }
        } else if updateStatus != errSecSuccess {
            throw KeychainError.unhandled(updateStatus)
        }
    }

    func getData(forKey key: String, service: String) throws -> Data? {
        var query = baseQuery(key: key, service: service)
        query[kSecReturnData as String] = kCFBooleanTrue
        query[kSecMatchLimit as String] = kSecMatchLimitOne
        var item: CFTypeRef?
        let status = SecItemCopyMatching(query as CFDictionary, &item)
        if status == errSecItemNotFound { return nil }
        guard status == errSecSuccess else {
            throw KeychainError.unhandled(status)
        }
        return item as? Data
    }

    private func baseQuery(key: String, service: String) -> [String: Any] {
        [
            kSecClass as String: kSecClassGenericPassword,
            kSecAttrService as String: service,
            kSecAttrAccount as String: key,
        ]
    }
}
