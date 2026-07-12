function Resolve-BackendRuntimeManifestPath {
    param(
        [string]$ManifestPath = $null
    )

    $candidate =
        if (-not [string]::IsNullOrWhiteSpace($ManifestPath)) { $ManifestPath.Trim() }
        elseif (-not [string]::IsNullOrWhiteSpace($env:BACKEND_RUNTIME_MANIFEST)) { $env:BACKEND_RUNTIME_MANIFEST.Trim() }
        else { $null }

    if ([string]::IsNullOrWhiteSpace($candidate)) {
        return $null
    }

    $resolved = Resolve-Path -LiteralPath $candidate -ErrorAction SilentlyContinue
    if ($resolved) {
        return $resolved.Path
    }

    return [System.IO.Path]::GetFullPath($candidate)
}

function Convert-BackendRuntimeManifestField {
    param(
        [object]$Value
    )

    if ($null -eq $Value) {
        return $null
    }

    $text = [string]$Value
    if ([string]::IsNullOrWhiteSpace($text)) {
        return $null
    }

    return $text.Trim()
}

function Resolve-BackendRuntimeManifestFileField {
    param(
        [string]$ManifestDirectory,
        [object]$Value
    )

    $text = Convert-BackendRuntimeManifestField -Value $Value
    if ([string]::IsNullOrWhiteSpace($text)) {
        return $null
    }

    if ([System.IO.Path]::IsPathRooted($text)) {
        return [System.IO.Path]::GetFullPath($text)
    }

    return [System.IO.Path]::GetFullPath((Join-Path $ManifestDirectory $text))
}

function Resolve-BackendRuntimeManifestHealthUrl {
    param(
        [object]$BaseUrlValue,
        [object]$HealthUrlValue
    )

    $healthUrl = Convert-BackendRuntimeManifestField -Value $HealthUrlValue
    if (-not [string]::IsNullOrWhiteSpace($healthUrl)) {
        return $healthUrl
    }

    $baseUrl = Convert-BackendRuntimeManifestField -Value $BaseUrlValue
    if ([string]::IsNullOrWhiteSpace($baseUrl)) {
        return $null
    }

    $trimmedBaseUrl = $baseUrl.TrimEnd('/')
    if ($trimmedBaseUrl -match '/api$') {
        return $trimmedBaseUrl -replace '/api$','/health'
    }

    return "$trimmedBaseUrl/health"
}

function Resolve-BackendRuntimeManifestMongoDbName {
    param(
        [object]$MongoUriValue
    )

    $mongoUri = Convert-BackendRuntimeManifestField -Value $MongoUriValue
    if ([string]::IsNullOrWhiteSpace($mongoUri)) {
        return $null
    }

    $withoutScheme = $mongoUri -replace '^mongodb(\+srv)?:\/\/',''
    $pathStart = $withoutScheme.IndexOf('/')
    if ($pathStart -lt 0) {
        return $null
    }

    $dbSegment = $withoutScheme.Substring($pathStart + 1)
    if ([string]::IsNullOrWhiteSpace($dbSegment)) {
        return $null
    }

    $dbSegment = ($dbSegment -split '\?')[0]
    $dbSegment = ($dbSegment -split '/')[0]
    $dbSegment = $dbSegment.Trim()

    if ([string]::IsNullOrWhiteSpace($dbSegment)) {
        return $null
    }

    return $dbSegment
}

function Import-BackendRuntimeManifest {
    param(
        [string]$ManifestPath = $null
    )

    $resolvedPath = Resolve-BackendRuntimeManifestPath -ManifestPath $ManifestPath
    if ([string]::IsNullOrWhiteSpace($resolvedPath)) {
        return $null
    }

    if (-not (Test-Path -LiteralPath $resolvedPath)) {
        throw "Backend runtime manifest not found: $resolvedPath"
    }

    $raw = Get-Content -LiteralPath $resolvedPath -Raw -Encoding UTF8
    $data = $raw | ConvertFrom-Json
    $manifestDir = Split-Path -Parent $resolvedPath

    $backendBaseUrl = Convert-BackendRuntimeManifestField -Value $data.backendBaseUrl
    $backendHealthUrl = Convert-BackendRuntimeManifestField -Value $data.backendHealthUrl
    $perfBackendBaseUrl =
        if ($data.PSObject.Properties.Name -contains 'perfBackendBaseUrl') {
            Convert-BackendRuntimeManifestField -Value $data.perfBackendBaseUrl
        } else {
            $null
        }
    $perfBackendHealthUrl =
        if ($data.PSObject.Properties.Name -contains 'perfBackendHealthUrl') {
            Convert-BackendRuntimeManifestField -Value $data.perfBackendHealthUrl
        } else {
            $null
        }
    $authRbacBaseUrl =
        if ($data.PSObject.Properties.Name -contains 'authRbacBaseUrl') {
            Convert-BackendRuntimeManifestField -Value $data.authRbacBaseUrl
        } else {
            $backendBaseUrl
        }
    $authHardeningBaseUrl =
        if ($data.PSObject.Properties.Name -contains 'authHardeningBaseUrl') {
            Convert-BackendRuntimeManifestField -Value $data.authHardeningBaseUrl
        } else {
            $backendBaseUrl
        }
    $mongodbUri = Convert-BackendRuntimeManifestField -Value $data.mongodbUri
    $mongodbDbName = Resolve-BackendRuntimeManifestMongoDbName -MongoUriValue $mongodbUri
    if (-not [string]::IsNullOrWhiteSpace($mongodbUri) -and [string]::IsNullOrWhiteSpace($mongodbDbName)) {
        throw "Backend runtime manifest mongodbUri does not include a database name: $mongodbUri"
    }
    $mediaDir = Resolve-BackendRuntimeManifestFileField -ManifestDirectory $manifestDir -Value $data.mediaDir
    $db06MediaDir =
        if ($data.PSObject.Properties.Name -contains 'db06MediaDir') {
            Resolve-BackendRuntimeManifestFileField -ManifestDirectory $manifestDir -Value $data.db06MediaDir
        } else {
            $null
        }

    return [pscustomobject]@{
        Path = $resolvedPath
        BackendBaseUrl = $backendBaseUrl
        BackendHealthUrl = $backendHealthUrl
        PerfBackendBaseUrl = $perfBackendBaseUrl
        PerfBackendHealthUrl = $perfBackendHealthUrl
        AuthRbacBaseUrl = $authRbacBaseUrl
        AuthHardeningBaseUrl = $authHardeningBaseUrl
        MongodbUri = $mongodbUri
        MongodbDbName = $mongodbDbName
        MediaDir = $mediaDir
        Db06MediaDir = $db06MediaDir
    }
}

function Use-BackendRuntimeManifest {
    param(
        [string]$ManifestPath = $null
    )

    $manifest = Import-BackendRuntimeManifest -ManifestPath $ManifestPath
    if ($null -eq $manifest) {
        return $null
    }

    $applied = New-Object System.Collections.Generic.List[string]

    if ([string]::IsNullOrWhiteSpace($env:BACKEND_BASE_URL) -and -not [string]::IsNullOrWhiteSpace($manifest.BackendBaseUrl)) {
        $env:BACKEND_BASE_URL = $manifest.BackendBaseUrl.TrimEnd('/')
        $applied.Add('BACKEND_BASE_URL')
    }
    if ([string]::IsNullOrWhiteSpace($env:BACKEND_HEALTH_URL) -and -not [string]::IsNullOrWhiteSpace($manifest.BackendHealthUrl)) {
        $env:BACKEND_HEALTH_URL = $manifest.BackendHealthUrl.TrimEnd('/')
        $applied.Add('BACKEND_HEALTH_URL')
    }
    $perfBackendHealthUrl = Resolve-BackendRuntimeManifestHealthUrl -BaseUrlValue $manifest.PerfBackendBaseUrl -HealthUrlValue $manifest.PerfBackendHealthUrl
    if ([string]::IsNullOrWhiteSpace($env:PERF_BACKEND_BASE_URL) -and -not [string]::IsNullOrWhiteSpace($manifest.PerfBackendBaseUrl)) {
        $env:PERF_BACKEND_BASE_URL = $manifest.PerfBackendBaseUrl.TrimEnd('/')
        $applied.Add('PERF_BACKEND_BASE_URL')
    }
    if ([string]::IsNullOrWhiteSpace($env:PERF_BACKEND_HEALTH_URL) -and -not [string]::IsNullOrWhiteSpace($perfBackendHealthUrl)) {
        $env:PERF_BACKEND_HEALTH_URL = $perfBackendHealthUrl.TrimEnd('/')
        $applied.Add('PERF_BACKEND_HEALTH_URL')
    }
    if ([string]::IsNullOrWhiteSpace($env:AUTH_RBAC_BASE_URL) -and -not [string]::IsNullOrWhiteSpace($manifest.AuthRbacBaseUrl)) {
        $env:AUTH_RBAC_BASE_URL = $manifest.AuthRbacBaseUrl.TrimEnd('/')
        $applied.Add('AUTH_RBAC_BASE_URL')
    }
    if ([string]::IsNullOrWhiteSpace($env:AUTH_HARDENING_BASE_URL) -and -not [string]::IsNullOrWhiteSpace($manifest.AuthHardeningBaseUrl)) {
        $env:AUTH_HARDENING_BASE_URL = $manifest.AuthHardeningBaseUrl.TrimEnd('/')
        $applied.Add('AUTH_HARDENING_BASE_URL')
    }
    if ([string]::IsNullOrWhiteSpace($env:MONGODB_URI) -and -not [string]::IsNullOrWhiteSpace($manifest.MongodbUri)) {
        $env:MONGODB_URI = $manifest.MongodbUri
        $applied.Add('MONGODB_URI')
    }
    if ([string]::IsNullOrWhiteSpace($env:MEDIA_DIR) -and -not [string]::IsNullOrWhiteSpace($manifest.MediaDir)) {
        $env:MEDIA_DIR = $manifest.MediaDir
        $applied.Add('MEDIA_DIR')
    }

    $db06MediaDir =
        if (-not [string]::IsNullOrWhiteSpace($manifest.Db06MediaDir)) { $manifest.Db06MediaDir }
        else { $manifest.MediaDir }
    if ([string]::IsNullOrWhiteSpace($env:DB06_MEDIA_DIR) -and -not [string]::IsNullOrWhiteSpace($db06MediaDir)) {
        $env:DB06_MEDIA_DIR = $db06MediaDir
        $applied.Add('DB06_MEDIA_DIR')
    }

    return [pscustomobject]@{
        Path = $manifest.Path
        Applied = @($applied)
    }
}
