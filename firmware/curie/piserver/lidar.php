<?php
$db_name = 'testdb';
$db_user = 'brave';
$db_password = 'brave';
$db_host = 'localhost';

$epochtimes = [];
$pixels = [];

try {
    $pdo = new PDO("pgsql:host=$db_host;dbname=$db_name", $db_user, $db_password);
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    $stmt = $pdo->query("SELECT epochtime FROM lidar5 ORDER BY epochtime DESC");
    $epochtimes = $stmt->fetchAll(PDO::FETCH_COLUMN);
    $selectedEpochtime = isset($_GET['epochtime']) ? $_GET['epochtime'] : $epochtimes[0];

    $stmt = $pdo->prepare("SELECT * FROM lidar5 WHERE epochtime = :epochtime LIMIT 1");
    $stmt->bindParam(':epochtime', $selectedEpochtime, PDO::PARAM_INT);
    $stmt->execute();
    $data = $stmt->fetch(PDO::FETCH_ASSOC);

    if ($data) {

        $pixels = array_values($data);
        for ($i = 0; $i < count($pixels); $i++) {
            $array = explode(",", trim($pixels[$i], "{}"));
            
            $pixels[$i] = array_map('intval', $array);

           // echo "pixels is " . " " . (string)$pixels[$i][0] . " " .(string)$pixels[$i][1] ." " . (string)$pixels[$i][2];
        }
        


        if (count($pixels) < 16) {
            for ($i = 0; $i < count($pixels); $i++) {
                $pixels[$i] = array_pad($pixels, 16, 0);
            }
        }
    } else {
        // Show blank if thermalcamera not populated
        $pixels = array_fill(0, 16, 0);
    }
    
} catch (PDOException $e) {
    echo "Something went horribly wrong (probably postgres): " . $e->getMessage();
    exit;
}

$minDistance = 1500;
$maxDistance = 2500;
//$minDistance = min($pixels);
//$maxDistance = max($pixels);
function colorGradiant($value, $minDistance, $maxDistance, $status) {
    //set the value to a normalized value between 0 and 1 (for the ironPallate mapping)
    $normalized = 0;
    if($maxDistance - $minDistance != 0){
        $normalized = ($value - $minDistance) / ($maxDistance - $minDistance);
    }
    $color = "";
    if($status == 5 || $status == 9){
        //WIP gradient, could be improved
        $r = (int)(255 * $normalized);  // Red increases as normalized goes from 0 to 1
        $g = 0;  // Green stays 0
        $b = 0;  // Blue stays 0
        $color = "rgb($r, $g, $b)";
    }
    
    if($status == 255){
        $color = "rgb(0, 255, 0)";
    }

    if($color == ""){
        $color = "rgb(255, 0, 255)";
    }

    return $color;
    
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>Lidar Heatmap</title>
    <style>
        
        body {
            font-family: sans-serif;
            display: flex;
            flex-direction: column;
            align-items: center;
            margin-top: 30px;
        }
        table {
            border-collapse: collapse;
        }
        td {
            width: 30px;
            height: 30px;
            padding: 0;
            border: 1px solid #ddd;
        }
        select {
            margin-bottom: 20px;
            padding: 5px;
        }
        h1 {
            text-align: center;
        }
    </style>
</head>
<body>
<h1 align="center">Lidar Distance Map</h1>
<h2 align="center"><a href="landingpage.php">Go to Landing</a></h2>

<!-- Dropdown for selecting epochtime -->
<form method="get" action="">
    <label for="epochtime">Select Timestamp:</label>
    <select name="epochtime" id="epochtime" onchange="this.form.submit()">
        <?php
        // Populate the dropdown with available epochtimes
        foreach ($epochtimes as $epochtime) {
            $selected = ($epochtime == $selectedEpochtime) ? 'selected' : '';
            echo "<option value='$epochtime' $selected>Timestamp: $epochtime</option>";
        }
        ?>
    </select>
</form>

<!--Programmatic table -->
<table>
    <?php
    $counter = 0;
    for ($row = 0; $row < 4; $row++) {
        echo "<tr>"; //Row start, 4 pixels per row
        for ($col = 0; $col < 4; $col++) {
            $status = $pixels[$counter][0];
            $targets = $pixels[$counter][1];
            $distance = $pixels[$counter][2];
            $counter++;
            $color = colorGradiant($distance, $minDistance, $maxDistance, $status);
            echo "<td style='background-color: $color;'>".number_format($targets, 0)."</td>";

        }
        echo "</tr>"; //Row end
    }
    ?>
</table>

</body>
</html>
